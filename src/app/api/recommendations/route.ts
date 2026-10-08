import { NextResponse } from 'next/server';
import { getProfileRecommendations, TmdbError } from '@/lib/tmdb';
import type { CineverseProfile } from '@/lib/profile-types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const profile = (await request.json()) as CineverseProfile;
    if (!profile?.id || !Array.isArray(profile.preferences)) return NextResponse.json({ error: 'Invalid profile' }, { status: 400 });
    const recommendations = await getProfileRecommendations(profile);
    return NextResponse.json({ recommendations, source: 'live-tmdb' });
  } catch (error) {
    const status = error instanceof TmdbError ? error.status : 502;
    return NextResponse.json({ error: 'Unable to load TMDB recommendations' }, { status });
  }
}
