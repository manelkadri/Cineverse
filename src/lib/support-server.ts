import 'server-only';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { mergeCategories, priorityId, priorityLabel, type AuditAction } from './support-meta';
import { ticketReference } from './support-rules';
import type { NotificationDraft } from './notification-events';

// ---------------------------------------------------------------- audit trail
/**
 * A prepared audit entry, meant to be committed in the SAME transaction as the change it records, so a sensitive action
 * can never succeed without its record (and vice versa). Metadata is small and never holds message text or secrets.
 */
export function auditEntry(actorId: string | null, action: AuditAction, resourceType: string, resourceId: string, metadata?: Record<string, string | number | boolean | null>) {
  return prisma.supportAuditLog.create({ data: { actorId, action, resourceType, resourceId, metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined } });
}

// ---------------------------------------------------------------- categories
/** The contact-form categories as configured; if the settings cannot be read, the built-in list (never an empty form). */
export async function loadCategories() {
  try {
    return mergeCategories(await prisma.supportCategory.findMany({ select: { id: true, label: true, enabled: true, position: true } }));
  } catch {
    return mergeCategories([]);
  }
}

// ---------------------------------------------------------------- settings
export interface Availability { enabled: boolean; text: string }

/** The configured availability text; disabled and empty until an administrator explicitly saves one. */
export async function loadAvailability(): Promise<Availability> {
  try {
    const row = await prisma.supportSetting.findUnique({ where: { key: 'availability' }, select: { value: true } });
    const value = row?.value as { enabled?: unknown; text?: unknown } | null | undefined;
    if (value && typeof value.text === 'string') return { enabled: value.enabled === true, text: value.text };
  } catch { /* not configured, or the settings table does not exist yet */ }
  return { enabled: false, text: '' };
}

// ---------------------------------------------------------------- tickets
export const ticketSelect = {
  id: true, userId: true, email: true, subject: true, category: true, message: true, status: true, adminNote: true, priority: true,
  awaitingStaff: true, firstResponseAt: true, createdAt: true, updatedAt: true, assignedToId: true,
  assignedTo: { select: { id: true, name: true } },
} as const;

type TicketRow = Prisma.SupportTicketGetPayload<{ select: typeof ticketSelect }>;

/** The ticket as the administration receives it. No internal field (hashes, the author's account id) leaves the server. */
export function presentTicket({ userId, assignedTo, priority, firstResponseAt, ...ticket }: TicketRow) {
  return {
    ...ticket,
    reference: ticketReference(ticket.id),
    accountLinked: userId !== null,
    priority: priorityId(priority),
    priorityLabel: priorityLabel(priority),
    assignedTo: assignedTo ? { id: assignedTo.id, name: assignedTo.name ?? 'Administrateur' } : null,
    firstResponseAt: firstResponseAt ? firstResponseAt.toISOString() : null,
  };
}

export function presentMessage(message: { id: string; senderType: string; body: string; visibility: string; createdAt: Date; author?: { name: string | null } | null }) {
  return {
    id: message.id,
    senderType: message.senderType,
    visibility: message.visibility,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
    authorName: message.senderType === 'staff' ? (message.author?.name ?? 'Équipe de support') : null,
  };
}

export const bodyHash = (ticketId: string, senderType: string, body: string) =>
  createHash('sha256').update(`${ticketId}|${senderType}|${body.toLowerCase().replace(/\s+/g, ' ')}`).digest('hex').slice(0, 32);

// ---------------------------------------------------------------- administrator notifications
export type AdminEvent = 'notifyNewTicket' | 'notifyUserReply' | 'notifyHighPriority' | 'notifyAssigned' | 'notifyReopened';

/**
 * Notifies support administrators who left this event switched on (all of them by default), except the one who caused
 * it. Uses the main notification system, with an `admin_` type so the administration can list them separately. It never
 * blocks the action that triggered it, and an event is never delivered twice to the same administrator.
 */
export async function notifyAdmins(event: AdminEvent, draft: NotificationDraft, options: { exceptUserId?: string; onlyUserId?: string } = {}) {
  try {
    const admins = await prisma.user.findMany({
      where: { isSupportAdmin: true, ...(options.onlyUserId ? { id: options.onlyUserId } : {}) },
      select: { id: true, supportAdminPreference: true },
    });
    const recipients = admins.filter((admin) => admin.id !== options.exceptUserId && (admin.supportAdminPreference ? admin.supportAdminPreference[event] : true));
    if (recipients.length === 0) return 0;
    const result = await prisma.notification.createMany({
      data: recipients.map((admin) => ({ userId: admin.id, category: draft.category, type: draft.type, title: draft.title, message: draft.message, href: draft.href, dedupeKey: draft.dedupeKey })),
      skipDuplicates: true,
    });
    return result.count;
  } catch (error) {
    console.error(`[support] administrator notification failed (${(error as { code?: string }).code ?? 'unexpected error'})`);
    return 0;
  }
}
