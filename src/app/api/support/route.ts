import { createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authSecret, isAuthRuntimeConfigured } from '@/lib/auth-security';
import { authenticatedContext } from '@/lib/server-auth';
import { crossSiteResponse } from '@/lib/account-api';
import { ticketReference } from '@/lib/support-admin';
import { loadCategories, notifyAdmins } from '@/lib/support-server';
import { SENSITIVE_CONTENT_MESSAGE, SUPPORT_LIMITS, containsSensitiveContent, countLinks } from '@/lib/support-rules';
import { supportRequestSchema } from '@/lib/validation';
import { notify } from '@/lib/notifications';
import { adminTicketNew, ticketCreated } from '@/lib/notification-events';

export const runtime = 'nodejs';

const HOUR = 60 * 60 * 1000;
// Limits count stored tickets. Visitors share addresses (offices, schools), so the per-address limit is a spam brake, not a quota.
const LIMITS = [
  { key: 'ip' as const, max: 5, windowMs: HOUR },
  { key: 'email' as const, max: 3, windowMs: HOUR },
  { key: 'user' as const, max: 10, windowMs: 24 * HOUR },
  { key: 'all' as const, max: 300, windowMs: HOUR },
];

const hmac = (value: string) => createHmac('sha256', authSecret()).update(value).digest('hex');
const clientAddress = (request: Request) => (request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown').slice(0, 64);
const fail = (status: number, code: string, error: string, extra: Record<string, unknown> = {}, headers?: Record<string, string>) => NextResponse.json({ error, code, ...extra }, { status, headers });

// A visitor or a signed-in member asks for help. Nothing is reported as sent unless the ticket is really stored, and no
// e-mail is sent by this route: support staff read the tickets in the admin area.
export async function POST(request: Request) {
  if (!isAuthRuntimeConfigured()) return fail(503, 'SUPPORT_UNAVAILABLE', 'Le support n’est pas disponible pour le moment.');
  const blocked = crossSiteResponse(request);
  if (blocked) return blocked;

  const body = await request.json().catch(() => null);
  const parsed = supportRequestSchema.safeParse(body);
  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;
    return fail(400, 'INVALID_REQUEST', parsed.error.issues[0]?.message ?? 'Demande invalide.', { fields });
  }
  const input = parsed.data;
  // the category must be one the form currently offers (they are editable by the administration)
  const categories = await loadCategories();
  if (!categories.some((category) => category.id === input.category && category.enabled)) return fail(400, 'INVALID_REQUEST', 'Choisissez une catégorie.', { fields: { category: ['Choisissez une catégorie.'] } });
  if (input.website) return fail(400, 'SPAM', 'Demande invalide.');
  if (typeof input.elapsedMs === 'number' && input.elapsedMs < SUPPORT_LIMITS.minFillMs) return fail(400, 'TOO_FAST', 'Relisez votre message puis réessayez dans un instant.');
  if (containsSensitiveContent(`${input.subject}\n${input.message}`)) return fail(400, 'SENSITIVE_CONTENT', SENSITIVE_CONTENT_MESSAGE, { fields: { message: [SENSITIVE_CONTENT_MESSAGE] } });
  if (countLinks(`${input.subject}\n${input.message}`) > SUPPORT_LIMITS.maxLinks) return fail(400, 'TOO_MANY_LINKS', 'Votre message contient trop de liens. Décrivez le problème en quelques mots.', { fields: { message: ['Trop de liens.'] } });

  // An account is attached only from the real session, never from anything the client sends.
  const context = await authenticatedContext();
  const userId = context?.userId ?? null;
  const ipHash = hmac(`support|ip|${clientAddress(request)}`);
  const messageHash = hmac(`support|message|${input.email}|${input.message.toLowerCase().replace(/\s+/g, ' ')}`);

  try {
    const ticket = await prisma.supportTicket.create({
      data: { userId, email: input.email, subject: input.subject, category: input.category, message: input.message, ipHash, messageHash },
      select: { id: true, createdAt: true },
    });

    // Reserve first, then verify by rank (like the PIN attempts): a parallel burst cannot slip past a limit, because
    // every ticket knows how many earlier tickets match, and the ones beyond the limit remove themselves.
    const earlier = { OR: [{ createdAt: { lt: ticket.createdAt } }, { createdAt: ticket.createdAt, id: { lt: ticket.id } }] };
    const duplicate = await prisma.supportTicket.count({ where: { messageHash, createdAt: { gte: new Date(Date.now() - 24 * HOUR) }, AND: [earlier] } });
    if (duplicate > 0) {
      await prisma.supportTicket.delete({ where: { id: ticket.id } });
      return fail(409, 'DUPLICATE', 'Cette demande a déjà été enregistrée : aucun doublon n’a été créé.');
    }
    for (const limit of LIMITS) {
      if (limit.key === 'user' && !userId) continue;
      const scope = limit.key === 'ip' ? { ipHash } : limit.key === 'email' ? { email: input.email } : limit.key === 'user' ? { userId } : {};
      const since = new Date(Date.now() - limit.windowMs);
      const rank = await prisma.supportTicket.count({ where: { ...scope, createdAt: { gte: since }, AND: [earlier] } });
      if (rank >= limit.max) {
        const oldest = await prisma.supportTicket.findFirst({ where: { ...scope, createdAt: { gte: since } }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } });
        await prisma.supportTicket.delete({ where: { id: ticket.id } });
        const retryAfter = Math.max(60, Math.ceil(((oldest?.createdAt.getTime() ?? Date.now()) + limit.windowMs - Date.now()) / 1000));
        return fail(429, 'RATE_LIMITED', 'Vous avez envoyé trop de demandes récemment. Réessayez plus tard.', { retryAfterSeconds: retryAfter }, { 'Retry-After': String(retryAfter) });
      }
    }
    // Only the member who was signed in when sending is notified; a guest ticket notifies nobody.
    if (userId) await notify(userId, ticketCreated(ticket.id, input.subject));
    await notifyAdmins('notifyNewTicket', adminTicketNew(ticket.id, input.subject));
    return NextResponse.json({ stored: true, reference: ticketReference(ticket.id), createdAt: ticket.createdAt.toISOString(), emailSent: false }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    // P2021/P2022: the support tables are not in the database yet. Anything else is unexpected. Either way nothing was stored.
    const code = (error as { code?: string }).code;
    if (code === 'P2021' || code === 'P2022') return fail(503, 'SUPPORT_UNAVAILABLE', 'Le support n’est pas encore activé sur ce serveur. Votre demande n’a pas été enregistrée.');
    return fail(500, 'SERVER_ERROR', 'Votre demande n’a pas pu être enregistrée. Réessayez dans un instant.');
  }
}
