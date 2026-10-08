import { NextResponse } from 'next/server';
import { getMediaSummaries, TmdbError } from '@/lib/tmdb';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { ids?: unknown };
    const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === 'string').slice(0, 50) : [];
    return NextResponse.json({ items: await getMediaSummaries(ids) });
  } catch (error) {
    const status = error instanceof TmdbError ? error.status : 400;
    return NextResponse.json({ error: 'Unable to load TMDB media' }, { status });
  }
}
