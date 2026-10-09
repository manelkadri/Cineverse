import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSupportAdmin } from '@/lib/support-admin';
import { auditEntry, notifyAdmins, presentMessage, presentTicket, ticketSelect } from '@/lib/support-server';
import { isHighPriority, priorityId, priorityLabel, priorityLevel } from '@/lib/support-meta';
import { ticketReference } from '@/lib/support-rules';
import { notify } from '@/lib/notifications';
import { adminAssigned, adminHighPriority, adminReopened, ticketStatusChanged } from '@/lib/notification-events';
import { supportTicketPatchSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FINISHED = ['resolved', 'closed'];

// Support staff only. The ticket, its whole conversation (including private staff notes) and its audit history.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireSupportAdmin(request);
  if ('response' in access) return access.response;
  const { id } = await params;
  const ticket = await prisma.supportTicket.findUnique({ where: { id }, select: ticketSelect });
  if (!ticket) return NextResponse.json({ error: 'Ticket introuvable.', code: 'NOT_FOUND' }, { status: 404 });
  const [messages, history] = await Promise.all([
    prisma.supportMessage.findMany({ where: { ticketId: id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 500, select: { id: true, senderType: true, body: true, visibility: true, createdAt: true, author: { select: { name: true } } } }),
    prisma.supportAuditLog.findMany({ where: { resourceType: 'ticket', resourceId: id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 30, select: { id: true, action: true, metadata: true, createdAt: true, actor: { select: { name: true } } } }),
  ]);
  const presented = presentTicket(ticket);
  return NextResponse.json({
    ticket: presented,
    // the very first message is the one stored with the ticket; a guest ticket has no account to deliver replies to
    canReplyPublicly: presented.accountLinked,
    messages: messages.map(presentMessage),
    history: history.map((entry) => ({ id: entry.id, action: entry.action, metadata: entry.metadata, createdAt: entry.createdAt.toISOString(), actorName: entry.actor?.name ?? 'Compte supprimé' })),
  }, { headers: { 'Cache-Control': 'no-store' } });
}

// Support staff only. Status, priority, assignment and the legacy internal note; every real change is recorded in the audit
// log in the same transaction, and notifies the people concerned (the author, the new assignee, other administrators).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireSupportAdmin(request, { mutation: true });
  if ('response' in access) return access.response;
  const actorId = access.context.userId;
  const parsed = supportTicketPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Demande invalide.', code: 'INVALID_REQUEST' }, { status: 400 });
  const input = parsed.data;
  const { id } = await params;
  const existing = await prisma.supportTicket.findUnique({ where: { id }, select: { id: true, status: true, priority: true, assignedToId: true, adminNote: true, userId: true } });
  if (!existing) return NextResponse.json({ error: 'Ticket introuvable.', code: 'NOT_FOUND' }, { status: 404 });

  // Only an existing support administrator can be assigned: nobody can be given access this way.
  if (typeof input.assignedToId === 'string') {
    const assignee = await prisma.user.findFirst({ where: { id: input.assignedToId, isSupportAdmin: true }, select: { id: true } });
    if (!assignee) return NextResponse.json({ error: 'Ce compte n’est pas un administrateur du support.', code: 'ASSIGNEE_INVALID' }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  const audits: ReturnType<typeof auditEntry>[] = [];
  const statusChanged = input.status !== undefined && input.status !== existing.status;
  const reopened = statusChanged && input.status === 'open' && FINISHED.includes(existing.status);
  const newLevel = input.priority !== undefined ? priorityLevel(input.priority) : existing.priority;
  const priorityChanged = newLevel !== existing.priority;
  const assignmentChanged = input.assignedToId !== undefined && input.assignedToId !== existing.assignedToId;
  const noteChanged = input.adminNote !== undefined && input.adminNote !== (existing.adminNote ?? '');

  if (statusChanged) {
    data.status = input.status;
    data.awaitingStaff = reopened; // staff looked at it; a reopened ticket needs attention again
    audits.push(auditEntry(actorId, 'ticket.status_changed', 'ticket', id, { from: existing.status, to: input.status as string }));
  }
  if (priorityChanged) {
    data.priority = newLevel;
    audits.push(auditEntry(actorId, 'ticket.priority_changed', 'ticket', id, { from: priorityId(existing.priority), to: priorityId(newLevel) }));
  }
  if (assignmentChanged) {
    data.assignedToId = input.assignedToId;
    audits.push(auditEntry(actorId, 'ticket.assigned', 'ticket', id, { from: existing.assignedToId, to: input.assignedToId ?? null }));
  }
  if (input.adminNote !== undefined) {
    data.adminNote = input.adminNote;
    if (noteChanged) audits.push(auditEntry(actorId, 'ticket.note_updated', 'ticket', id));
  }

  const [ticket] = await prisma.$transaction([prisma.supportTicket.update({ where: { id }, data, select: ticketSelect }), ...audits]);
  const changedAt = ticket.updatedAt.getTime();

  // Notifications never block the change: they are best effort.
  if (statusChanged && existing.userId) await notify(existing.userId, ticketStatusChanged(id, ticket.status, changedAt));
  if (reopened) await notifyAdmins('notifyReopened', adminReopened(id, changedAt), { exceptUserId: actorId });
  if (priorityChanged && isHighPriority(newLevel)) await notifyAdmins('notifyHighPriority', adminHighPriority(id, priorityLabel(newLevel), changedAt), { exceptUserId: actorId });
  if (assignmentChanged && input.assignedToId && input.assignedToId !== actorId) await notifyAdmins('notifyAssigned', adminAssigned(id, input.assignedToId, changedAt), { onlyUserId: input.assignedToId });

  return NextResponse.json({ ticket: presentTicket(ticket) }, { headers: { 'Cache-Control': 'no-store' } });
}

// Permanently erases one ticket and its conversation (for example when its author asks for their data to be removed).
// The audit log keeps the fact of the deletion (reference only, no content).
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireSupportAdmin(request, { mutation: true });
  if ('response' in access) return access.response;
  const { id } = await params;
  const existing = await prisma.supportTicket.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: 'Ticket introuvable.', code: 'NOT_FOUND' }, { status: 404 });
  await prisma.$transaction([prisma.supportTicket.delete({ where: { id } }), auditEntry(access.context.userId, 'ticket.deleted', 'ticket', id, { reference: ticketReference(id) })]);
  return NextResponse.json({ deleted: true }, { headers: { 'Cache-Control': 'no-store' } });
}
