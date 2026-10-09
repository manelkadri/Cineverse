import 'server-only';
import { getToken } from 'next-auth/jwt';
import { cookies, headers } from 'next/headers';
import { prisma } from './prisma';
import { authSecret } from './auth-security';

/**
 * What the browser's session cookie amounts to, with failures told apart (the plain `authenticatedContext()` answers "null" for all of them):
 *  - authenticated: a valid signed cookie AND a live server-side Session row
 *  - unauthenticated: no cookie, or a cookie that is not validly signed
 *  - expired: a validly signed cookie whose server-side session is gone (logged out elsewhere, expired, database restored)
 *  - unavailable: the database could not be reached to check, so nothing can be said about the session
 *  - misconfigured: the server has no AUTH_SECRET / DATABASE_URL
 */
export type SessionState =
  | { state: 'authenticated'; userId: string; sid: string }
  | { state: 'unauthenticated' | 'expired' | 'unavailable' | 'misconfigured' };

export async function resolveSessionState(): Promise<SessionState> {
  const secret = authSecret();
  if (!secret || !process.env.DATABASE_URL) return { state: 'misconfigured' };
  let userId = '';
  let sid = '';
  try {
    const [jar, requestHeaders] = await Promise.all([cookies(), headers()]);
    const token = await getToken({
      req: { cookies: Object.fromEntries(jar.getAll().map((cookie) => [cookie.name, cookie.value])), headers: Object.fromEntries(requestHeaders.entries()) } as never,
      secret,
    });
    sid = typeof token?.sid === 'string' ? token.sid : '';
    userId = String(token?.userId ?? token?.sub ?? '');
  } catch {
    return { state: 'unauthenticated' };
  }
  if (!sid || !userId) return { state: 'unauthenticated' };
  try {
    const active = await prisma.session.findFirst({ where: { sessionToken: sid, userId, expires: { gt: new Date() } }, select: { id: true } });
    return active ? { state: 'authenticated', userId, sid } : { state: 'expired' };
  } catch (error) {
    // never log the connection string or the session id: only the kind of failure
    console.error(`[auth] session check failed (${(error as { code?: string }).code ?? (error as Error).name ?? 'unexpected error'})`);
    return { state: 'unavailable' };
  }
}
