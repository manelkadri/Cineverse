import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSupportAdmin } from '@/lib/support-admin';
import { notificationsFailure } from '@/lib/notifications';
import { auditEntry } from '@/lib/support-server';

export const runtime = 'nodejs';

// Support staff only. Withdraws an announcement: the database cascade removes the notification from every account.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireSupportAdmin(request, { mutation: true });
  if ('response' in access) return access.response;
  const { id } = await params;
  try {
    const existing = await prisma.announcement.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: 'Annonce introuvable.', code: 'NOT_FOUND' }, { status: 404 });
    await prisma.$transaction([prisma.announcement.delete({ where: { id } }), auditEntry(access.context.userId, 'announcement.withdrawn', 'announcement', id)]);
    return NextResponse.json({ deleted: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return notificationsFailure(error);
  }
}
