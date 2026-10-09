import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticatedUserId } from '@/lib/server-auth';
import { isAuthRuntimeConfigured } from '@/lib/auth-security';
import { profileSelectionSchema } from '@/lib/validation';

export const runtime = 'nodejs';

export async function PUT(request: Request) {
  if (!isAuthRuntimeConfigured()) return NextResponse.json({ error: 'Database authentication is not configured' }, { status: 503 });
  const userId = await authenticatedUserId();
  if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const parsed = profileSelectionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid profile selection' }, { status: 400 });
  const { profileId } = parsed.data;
  if (profileId) {
    const profile = await prisma.profile.findFirst({ where: { id: profileId, userId }, select: { id: true } });
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }
  await prisma.user.update({ where: { id: userId }, data: { selectedProfileId: profileId } });
  return NextResponse.json({ selectedProfileId: profileId });
}
