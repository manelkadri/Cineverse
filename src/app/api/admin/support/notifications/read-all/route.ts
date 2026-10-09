import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSupportAdmin } from '@/lib/support-admin';

export const runtime = 'nodejs';

// Marks the administrator's SUPPORT notifications as read. The member's personal notifications are left alone.
export async function POST(request: Request) {
  const access = await requireSupportAdmin(request, { mutation: true });
  if ('response' in access) return access.response;
  const result = await prisma.notification.updateMany({ where: { userId: access.context.userId, type: { startsWith: 'admin_' }, readAt: null }, data: { readAt: new Date() } });
  return NextResponse.json({ updated: result.count, unreadCount: 0 }, { headers: { 'Cache-Control': 'no-store' } });
}
