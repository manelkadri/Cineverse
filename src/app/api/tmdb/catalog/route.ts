import { NextRequest, NextResponse } from 'next/server';
import { getCatalog, TmdbError } from '@/lib/tmdb';
import type { CatalogQuery } from '@/lib/tmdb-types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mediaType = params.get('type');
  const category = params.get('category');
  const sort = params.get('sort');
  const query: CatalogQuery = {
    query: params.get('query')?.slice(0, 120) || undefined,
    mediaType: mediaType === 'movie' || mediaType === 'tv' ? mediaType : 'all',
    category: category === 'trending' || category === 'top-rated' || category === 'new' ? category : 'popular',
    genreId: Number(params.get('genre')) || undefined,
    year: Number(params.get('year')) || undefined,
    minRating: Number(params.get('rating')) || undefined,
    sort: sort === 'rating' || sort === 'newest' || sort === 'oldest' || sort === 'title' ? sort : 'popularity',
    page: Math.max(1, Math.min(500, Number(params.get('page')) || 1)),
  };
  try {
    return NextResponse.json(await getCatalog(query));
  } catch (error) {
    const status = error instanceof TmdbError ? error.status : 502;
    return NextResponse.json({ error: 'Unable to load TMDB catalog' }, { status });
  }
}
