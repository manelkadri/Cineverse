import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notificationsFailure, requireNotificationUser } from '@/lib/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The number behind the red badge: unread notifications of the signed-in account, straight from the database.
export async function GET(request: Request) {
  const access = await requireNotificationUser(request);
  if ('response' in access) return access.response;
  try {
    const unreadCount = await prisma.notification.count({ where: { userId: access.context.userId, readAt: null } });
    return NextResponse.json({ unreadCount }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return notificationsFailure(error);
  }
}
