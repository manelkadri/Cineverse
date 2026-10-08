import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getProviderUserId } from '@/lib/profile-db';

export const runtime = 'nodejs';

export async function PUT(request: Request) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'DATABASE_URL is not configured' }, { status: 503 });
  const { profileId } = (await request.json()) as { profileId?: string | null };
  const providerUserId = getProviderUserId(request);
  if (!providerUserId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const user = await prisma.user.upsert({ where: { providerUserId }, update: {}, create: { providerUserId } });
  if (profileId) {
    const profile = await prisma.profile.findFirst({ where: { id: profileId, userId: user.id } });
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }
  await prisma.user.update({ where: { id: user.id }, data: { selectedProfileId: profileId ?? null } });
  return NextResponse.json({ selectedProfileId: profileId ?? null });
}
