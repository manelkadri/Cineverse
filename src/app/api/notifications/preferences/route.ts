import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notificationsFailure, requireNotificationUser } from '@/lib/notifications';
import { notificationPreferencesSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const select = { notifyCatalogue: true, notifyService: true } as const;
const present = (user: { notifyCatalogue: boolean; notifyService: boolean }) => ({
  catalogue: user.notifyCatalogue,
  service: user.notifyService,
  // Security and support-ticket notifications cannot be switched off: they are listed here so the UI can say so.
  alwaysOn: ['security', 'support'],
});

// Only the two non-essential categories are configurable (strict schema: nothing else is accepted).
export async function GET(request: Request) {
  const access = await requireNotificationUser(request);
  if ('response' in access) return access.response;
  try {
    const user = await prisma.user.findUnique({ where: { id: access.context.userId }, select });
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    return NextResponse.json(present(user), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return notificationsFailure(error);
  }
}

export async function PUT(request: Request) {
  const access = await requireNotificationUser(request, { mutation: true });
  if ('response' in access) return access.response;
  const parsed = notificationPreferencesSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Demande invalide.', code: 'INVALID_REQUEST' }, { status: 400 });
  try {
    const user = await prisma.user.update({
      where: { id: access.context.userId },
      data: { ...(parsed.data.catalogue !== undefined ? { notifyCatalogue: parsed.data.catalogue } : {}), ...(parsed.data.service !== undefined ? { notifyService: parsed.data.service } : {}) },
      select,
    });
    return NextResponse.json(present(user), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return notificationsFailure(error);
  }
}
