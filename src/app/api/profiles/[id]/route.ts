import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getProviderUserId } from '@/lib/profile-db';

export const runtime = 'nodejs';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'DATABASE_URL is not configured' }, { status: 503 });
  const { id } = await params;
  const providerUserId = getProviderUserId(request);
  if (!providerUserId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const profile = await prisma.profile.findFirst({ where: { id, user: { providerUserId } } });
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  await prisma.profile.delete({ where: { id } });
  await prisma.user.updateMany({ where: { providerUserId, selectedProfileId: id }, data: { selectedProfileId: null } });
  return NextResponse.json({ deleted: true });
}
