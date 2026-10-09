import { NextResponse } from 'next/server';
import { loadPublishedKnowledgeBase } from '@/lib/kb-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public and read-only: is this Help Center article currently PUBLISHED? Only the middleware uses it, to answer a draft, hidden
// or unknown article with a real HTTP 404 (the page itself is streamed behind a loading boundary, which would commit a 200
// before it could say "not found"). It reveals nothing that the Help Center does not already show.
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get('slug') ?? '';
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 80) return NextResponse.json({ exists: false }, { headers: { 'Cache-Control': 'no-store' } });
  const { articles } = await loadPublishedKnowledgeBase();
  return NextResponse.json({ exists: articles.some((article) => article.slug === slug) }, { headers: { 'Cache-Control': 'no-store' } });
}
