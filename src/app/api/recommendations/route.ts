import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticatedUserId } from '@/lib/server-auth';
import { isAuthRuntimeConfigured } from '@/lib/auth-security';
import { profileInclude, toClientProfile } from '@/lib/profile-db';
import { recommendationRequestSchema } from '@/lib/validation';
import { getProfileRecommendations, TmdbError } from '@/lib/tmdb';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!isAuthRuntimeConfigured()) return NextResponse.json({ error: 'Database authentication is not configured' }, { status: 503 });
  const userId = await authenticatedUserId();
  if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const parsed = recommendationRequestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid recommendation request' }, { status: 400 });
  try {
    let profileId = parsed.data.profileId;
    if (!profileId) profileId = (await prisma.user.findUnique({ where: { id: userId }, select: { selectedProfileId: true } }))?.selectedProfileId ?? undefined;
    if (!profileId) return NextResponse.json({ recommendations: [], source: 'live-tmdb' });
    const profile = await prisma.profile.findFirst({ where: { id: profileId, userId }, include: profileInclude });
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    const recommendations = await getProfileRecommendations(toClientProfile(profile));
    return NextResponse.json({ recommendations, source: 'live-tmdb' });
  } catch (error) {
    const status = error instanceof TmdbError ? error.status : 502;
    return NextResponse.json({ error: 'Unable to load TMDB recommendations' }, { status });
  }
}
