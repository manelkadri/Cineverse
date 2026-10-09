import { getToken } from 'next-auth/jwt';
import { NextResponse, type NextRequest } from 'next/server';

export default async function middleware(request: NextRequest) {
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

export const config = { matcher: ['/', '/profiles/:path*', '/my-list/:path*', '/films-series-catalog/:path*', '/movie-series-detail/:path*'] };
