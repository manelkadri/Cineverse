import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notificationsFailure, requireNotificationUser } from '@/lib/notifications';

export const runtime = 'nodejs';

// Marks every unread notification of the signed-in account as read. Other accounts are never touched.
export async function POST(request: Request) {
  const access = await requireNotificationUser(request, { mutation: true });
  if ('response' in access) return access.response;
  try {
    const result = await prisma.notification.updateMany({ where: { userId: access.context.userId, readAt: null }, data: { readAt: new Date() } });
    return NextResponse.json({ updated: result.count, unreadCount: 0 }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return notificationsFailure(error);
  }
}
