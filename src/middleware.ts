import { getToken } from 'next-auth/jwt';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Help Center articles are public, but only PUBLISHED ones exist. The page is streamed behind the app-wide loading boundary, so it
 * cannot set a 404 status itself; this asks a tiny public endpoint whether the slug is published and answers a real 404 when it is
 * not. It fails open: if the check cannot run, the request continues and the page shows its own "not found" content.
 */
async function checkHelpArticle(request: NextRequest) {
  const slug = decodeURIComponent(request.nextUrl.pathname.split('/')[2] ?? '');
  try {
    const answer = await fetch(new URL(`/api/help/exists?slug=${encodeURIComponent(slug)}`, request.url), { cache: 'no-store' });
    if (answer.ok && (await answer.json()).exists === false) return NextResponse.rewrite(new URL('/help/__not-found__/missing', request.url));
  } catch { /* fail open */ }
  return NextResponse.next();
}

export default async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/help/')) return checkHelpArticle(request);

  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    const login = new URL('/login', request.url);
    login.searchParams.set('configuration', 'missing');
    return NextResponse.redirect(login);
  }
  const token = await getToken({ req: request, secret });
  if (!token) {
    const login = new URL('/login', request.url);
    login.searchParams.set('callbackUrl', request.nextUrl.href);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/', '/profiles/:path*', '/my-list/:path*', '/account/:path*', '/admin/:path*', '/films-series-catalog/:path*', '/movie-series-detail/:path*', '/help/:slug'] };
