import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAccount } from '@/lib/account-api';
import { bodyHash, notifyAdmins } from '@/lib/support-server';
import { SENSITIVE_CONTENT_MESSAGE, SUPPORT_LIMITS, containsSensitiveContent, countLinks } from '@/lib/support-rules';
import { SUPPORT_MESSAGE_LIMITS } from '@/lib/support-meta';
import { adminReopened, adminUserReply } from '@/lib/notification-events';
import { userSupportMessageSchema } from '@/lib/validation';

export const runtime = 'nodejs';

const HOUR = 60 * 60 * 1000;
const fail = (status: number, code: string, error: string, headers?: Record<string, string>) => NextResponse.json({ error, code }, { status, headers });

// A follow-up message from the member who owns the ticket. Ownership comes from the session (the ticket is looked up by id
// AND account), the text is validated and refused when it looks like a secret, and repeats and bursts are limited. A
// resolved or closed ticket is reopened by a new message.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireAccount(request, { mutation: true });
  if ('response' in access) return access.response;
  const { userId } = access.context;
  const parsed = userSupportMessageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(400, 'INVALID_REQUEST', parsed.error.issues[0]?.message ?? 'Message invalide.');
  const { body } = parsed.data;
  const { id } = await params;
  const ticket = await prisma.supportTicket.findFirst({ where: { id, userId }, select: { id: true, status: true } });
  if (!ticket) return fail(404, 'NOT_FOUND', 'Demande introuvable.');
  if (containsSensitiveContent(body)) return fail(400, 'SENSITIVE_CONTENT', SENSITIVE_CONTENT_MESSAGE);
  if (countLinks(body) > SUPPORT_LIMITS.maxLinks) return fail(400, 'TOO_MANY_LINKS', 'Votre message contient trop de liens.');

  // Reserve first, then verify by rank (like tickets and PIN attempts): a parallel burst cannot slip past a limit, because the
  // messages beyond it remove themselves, and nothing else (reopening, notifications) happens before the checks pass.
  const hash = bodyHash(id, 'user', body);
  const message = await prisma.supportMessage.create({ data: { ticketId: id, senderType: 'user', authorId: userId, body, visibility: 'public', bodyHash: hash }, select: { id: true, createdAt: true } });
  const earlier = { OR: [{ createdAt: { lt: message.createdAt } }, { createdAt: message.createdAt, id: { lt: message.id } }] };
  const own = { authorId: userId, senderType: 'user' };
  const duplicates = await prisma.supportMessage.count({ where: { ticketId: id, ...own, bodyHash: hash, createdAt: { gte: new Date(Date.now() - SUPPORT_MESSAGE_LIMITS.duplicateWindowMs) }, AND: [earlier] } });
  if (duplicates > 0) { await prisma.supportMessage.delete({ where: { id: message.id } }); return fail(409, 'DUPLICATE', 'Ce message vient déjà d’être envoyé.'); }
  const onTicket = await prisma.supportMessage.count({ where: { ticketId: id, ...own, createdAt: { gte: new Date(Date.now() - HOUR) }, AND: [earlier] } });
  const today = await prisma.supportMessage.count({ where: { ...own, createdAt: { gte: new Date(Date.now() - 24 * HOUR) }, AND: [earlier] } });
  if (onTicket >= SUPPORT_MESSAGE_LIMITS.perTicketPerHour || today >= SUPPORT_MESSAGE_LIMITS.perUserPerDay) {
    await prisma.supportMessage.delete({ where: { id: message.id } });
    return fail(429, 'RATE_LIMITED', 'Vous avez envoyé trop de messages récemment. Réessayez plus tard.', { 'Retry-After': '900' });
  }

  const reopened = ticket.status === 'resolved' || ticket.status === 'closed';
  const updated = await prisma.supportTicket.update({ where: { id }, data: { awaitingStaff: true, ...(reopened ? { status: 'open' } : {}) }, select: { updatedAt: true } });
  if (reopened) await notifyAdmins('notifyReopened', adminReopened(id, updated.updatedAt.getTime()));
  await notifyAdmins('notifyUserReply', adminUserReply(id, message.id));
  return NextResponse.json({ message: { id: message.id, senderType: 'user', body, createdAt: message.createdAt.toISOString(), authorName: null }, reopened }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
