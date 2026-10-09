import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSupportAdmin } from '@/lib/support-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Who the administrator is, and how many administrator notifications are unread (for the sidebar badge).
export async function GET(request: Request) {
  const access = await requireSupportAdmin(request);
  if ('response' in access) return access.response;
  const { userId } = access.context;
  const [user, unread] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } }),
    prisma.notification.count({ where: { userId, readAt: null, type: { startsWith: 'admin_' } } }),
  ]);
  return NextResponse.json({ id: userId, name: user?.name ?? 'Administrateur', email: user?.email ?? '', unreadNotifications: unread }, { headers: { 'Cache-Control': 'no-store' } });
}
