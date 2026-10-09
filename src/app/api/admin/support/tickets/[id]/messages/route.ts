import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSupportAdmin } from '@/lib/support-admin';
import { bodyHash, presentMessage } from '@/lib/support-server';
import { SENSITIVE_CONTENT_MESSAGE, containsSensitiveContent } from '@/lib/support-rules';
import { notify } from '@/lib/notifications';
import { ticketReply } from '@/lib/notification-events';
import { staffSupportMessageSchema } from '@/lib/validation';

export const runtime = 'nodejs';

// Support staff only. Adds a message to a ticket's conversation:
//  - "public": a reply the ticket's author reads in their account. It is only possible when the ticket belongs to an account:
//    a ticket sent without signing in has no channel to deliver a reply, and CINEVERSE does not pretend otherwise.
//  - "internal": a private note, never returned to the author.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireSupportAdmin(request, { mutation: true });
  if ('response' in access) return access.response;
  const actorId = access.context.userId;
  const parsed = staffSupportMessageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Message invalide.', code: 'INVALID_REQUEST' }, { status: 400 });
  const { body, visibility } = parsed.data;
  const { id } = await params;
  const ticket = await prisma.supportTicket.findUnique({ where: { id }, select: { id: true, userId: true, firstResponseAt: true } });
  if (!ticket) return NextResponse.json({ error: 'Ticket introuvable.', code: 'NOT_FOUND' }, { status: 404 });

  if (visibility === 'public' && !ticket.userId) {
    return NextResponse.json({ error: 'Ce ticket a été envoyé sans compte : aucune réponse ne peut être livrée à son auteur depuis CINEVERSE. Utilisez « Répondre par e-mail » ou ajoutez une note interne.', code: 'NO_DELIVERY_CHANNEL' }, { status: 409 });
  }
  if (containsSensitiveContent(body)) return NextResponse.json({ error: SENSITIVE_CONTENT_MESSAGE, code: 'SENSITIVE_CONTENT' }, { status: 400 });

  // the same text sent twice in a row (a double click) is stored once
  const hash = bodyHash(id, 'staff', body);
  const duplicate = await prisma.supportMessage.count({ where: { ticketId: id, bodyHash: hash, authorId: actorId, visibility, createdAt: { gte: new Date(Date.now() - 2 * 60 * 1000) } } });
  if (duplicate > 0) return NextResponse.json({ error: 'Ce message vient déjà d’être envoyé.', code: 'DUPLICATE' }, { status: 409 });

  const isPublic = visibility === 'public';
  const created = await prisma.$transaction(async (tx) => {
    const message = await tx.supportMessage.create({ data: { ticketId: id, senderType: 'staff', authorId: actorId, body, visibility, bodyHash: hash }, select: { id: true, senderType: true, body: true, visibility: true, createdAt: true, author: { select: { name: true } } } });
    if (isPublic) await tx.supportTicket.update({ where: { id }, data: { awaitingStaff: false, firstResponseAt: ticket.firstResponseAt ?? message.createdAt } });
    await tx.supportAuditLog.create({ data: { actorId, action: isPublic ? 'ticket.reply' : 'ticket.internal_note', resourceType: 'ticket', resourceId: id, metadata: { messageId: message.id } } });
    return message;
  });

  if (isPublic && ticket.userId) await notify(ticket.userId, ticketReply(id, created.id));
  return NextResponse.json({ message: presentMessage(created) }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
