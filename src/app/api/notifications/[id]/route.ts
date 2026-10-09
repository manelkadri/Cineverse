import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notificationsFailure, requireNotificationUser, toItem } from '@/lib/notifications';
import { notificationReadSchema } from '@/lib/validation';

export const runtime = 'nodejs';

// Marks ONE notification read or unread. Ownership is part of the query (id AND the session's account), so a notification
// that belongs to someone else is indistinguishable from one that does not exist.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireNotificationUser(request, { mutation: true });
  if ('response' in access) return access.response;
  const parsed = notificationReadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Demande invalide.', code: 'INVALID_REQUEST' }, { status: 400 });
  const { id } = await params;
  try {
    const changed = await prisma.notification.updateMany({ where: { id, userId: access.context.userId }, data: { readAt: parsed.data.read ? new Date() : null } });
    if (changed.count === 0) return NextResponse.json({ error: 'Notification introuvable.', code: 'NOT_FOUND' }, { status: 404 });
    const [row, unreadCount] = await Promise.all([
      prisma.notification.findFirst({ where: { id, userId: access.context.userId }, select: { id: true, category: true, type: true, title: true, message: true, href: true, readAt: true, createdAt: true } }),
      prisma.notification.count({ where: { userId: access.context.userId, readAt: null } }),
    ]);
    return NextResponse.json({ notification: row ? toItem(row) : null, unreadCount }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return notificationsFailure(error);
  }
}
