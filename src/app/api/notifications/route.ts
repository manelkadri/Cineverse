import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notificationsFailure, requireNotificationUser, toItem } from '@/lib/notifications';
import { decodeCursor, encodeCursor } from '@/lib/notification-rules';
import { notificationListQuerySchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The signed-in account's notifications, newest first, with cursor pagination. The account comes from the session only:
// there is no user id in the URL, so another account's notifications cannot be requested.
export async function GET(request: Request) {
  const access = await requireNotificationUser(request);
  if ('response' in access) return access.response;
  const { userId } = access.context;
  const parsed = notificationListQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Paramètres invalides.', code: 'INVALID_REQUEST' }, { status: 400 });
  const { filter, limit, cursor } = parsed.data;
  const after = decodeCursor(cursor);
  if (cursor && !after) return NextResponse.json({ error: 'Curseur invalide.', code: 'INVALID_REQUEST' }, { status: 400 });
  try {
    const where = {
      userId,
      ...(filter === 'unread' ? { readAt: null } : {}),
      ...(after ? { OR: [{ createdAt: { lt: after.createdAt } }, { createdAt: after.createdAt, id: { lt: after.id } }] } : {}),
    };
    const [rows, unreadCount] = await Promise.all([
      prisma.notification.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit + 1, select: { id: true, category: true, type: true, title: true, message: true, href: true, readAt: true, createdAt: true } }),
      prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return NextResponse.json({
      notifications: page.map(toItem),
      unreadCount,
      nextCursor: rows.length > limit && last ? encodeCursor(last.createdAt, last.id) : null,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return notificationsFailure(error);
  }
}
