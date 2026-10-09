import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticatedContext } from '@/lib/server-auth';
import { isAuthRuntimeConfigured } from '@/lib/auth-security';
import { profileInclude, toClientProfile } from '@/lib/profile-db';
import { requireUnlockedProfile } from '@/lib/profile-access';
import { unlockedProfileId } from '@/lib/profile-unlock';
import { recommendationRequestSchema } from '@/lib/validation';
import { getProfileRecommendations, TmdbError } from '@/lib/tmdb';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!isAuthRuntimeConfigured()) return NextResponse.json({ error: 'Database authentication is not configured' }, { status: 503 });
  const context = await authenticatedContext();
  if (!context) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const parsed = recommendationRequestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid recommendation request' }, { status: 400 });
  try {
    // Without an explicit id, use the profile unlocked in this session (never a stored selection that was not unlocked here).
    const profileId = parsed.data.profileId ?? (await unlockedProfileId(context)) ?? undefined;
    if (!profileId) return NextResponse.json({ recommendations: [], source: 'live-tmdb' });
    const gate = await requireUnlockedProfile(profileId);
    if ('response' in gate) return gate.response;
    const profile = await prisma.profile.findFirstOrThrow({ where: { id: gate.profile.id, userId: context.userId }, include: profileInclude });
    const recommendations = await getProfileRecommendations(toClientProfile(profile));
    return NextResponse.json({ recommendations, source: 'live-tmdb' });
  } catch (error) {
    const status = error instanceof TmdbError ? error.status : 502;
    return NextResponse.json({ error: 'Unable to load TMDB recommendations' }, { status });
  }
}
