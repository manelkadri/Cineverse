import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { authIdentity, AuthRateLimitError, enforceAuthRateLimit, isAuthRuntimeConfigured } from '@/lib/auth-security';
import { emailSchema } from '@/lib/validation';

const handler = NextAuth(authOptions);

type RouteContext = Parameters<typeof handler>[1];

async function POST(request: Request, context: RouteContext) {
  // NextAuth reports a failed credentials login as 401 and cannot express "locked out",
  // so the throttle is checked here first and answered with a proper 429.
  if (isAuthRuntimeConfigured() && new URL(request.url).pathname.endsWith('/callback/credentials')) {
    const form = await request.clone().formData().catch(() => null);
    const email = emailSchema.safeParse(form?.get('email'));
    if (email.success) {
      try {
        await enforceAuthRateLimit(authIdentity(email.data, request.headers));
      } catch (error) {
        if (!(error instanceof AuthRateLimitError)) throw error;
        return NextResponse.json(
          { error: 'TooManyAttempts', url: new URL('/login?error=TooManyAttempts', request.url).toString() },
          { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } },
        );
      }
    }
  }
  return handler(request, context);
}

export { handler as GET, POST };
