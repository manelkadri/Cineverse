import { NextResponse } from 'next/server';
import { CONTENT_CATALOG, getRecommendations } from '@/lib/content';
import type { CineverseProfile } from '@/lib/profile-types';

export const dynamic = 'force-dynamic';

const GENRE_IDS: Record<string, number> = {
  Action: 28, Animation: 16, Aventure: 12, Crime: 80, Drame: 18,
  Famille: 10751, Fantastique: 14, Mystère: 9648, 'Science-fiction': 878, Thriller: 53,
};

export async function POST(request: Request) {
  const profile = (await request.json()) as CineverseProfile;
  const fallback = getRecommendations(profile, 10);
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey || profile.isKids) {
    return NextResponse.json({ recommendations: fallback, source: 'curated-tmdb-metadata' });
  }

  try {
    const genreIds = profile.preferences.map((genre) => GENRE_IDS[genre]).filter(Boolean).join('|');
    const query = new URLSearchParams({ api_key: apiKey, language: 'fr-FR', sort_by: 'popularity.desc', include_adult: 'false' });
    if (genreIds) query.set('with_genres', genreIds);
    const [movies, series] = await Promise.all([
      fetch(`https://api.themoviedb.org/3/discover/movie?${query}`, { next: { revalidate: 3600 } }).then((response) => response.ok ? response.json() : { results: [] }),
      fetch(`https://api.themoviedb.org/3/discover/tv?${query}`, { next: { revalidate: 3600 } }).then((response) => response.ok ? response.json() : { results: [] }),
    ]);
    const liveRank = new Map<number, number>();
    [...(movies.results ?? []), ...(series.results ?? [])].forEach((item: { id: number }, index: number) => liveRank.set(item.id, 100 - index));
    const excluded = new Set([...profile.watchlist, ...profile.favorites, ...profile.history.map((item) => item.mediaId)]);
    const recommendations = CONTENT_CATALOG
      .filter((item) => item.maturityLevel <= profile.maturityLevel && !excluded.has(item.id))
      .map((item) => ({ item, score: (liveRank.get(item.tmdbId) ?? 0) + item.genres.filter((genre) => profile.preferences.includes(genre)).length * 10 + item.rating }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(({ item }) => item);
    return NextResponse.json({ recommendations: recommendations.length ? recommendations : fallback, source: 'live-tmdb' });
  } catch {
    return NextResponse.json({ recommendations: fallback, source: 'curated-tmdb-metadata' });
  }
}
