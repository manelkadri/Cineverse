import 'server-only';
import { getServerSession } from 'next-auth';
import { getToken } from 'next-auth/jwt';
import { cookies, headers } from 'next/headers';
import { authOptions } from './auth';

export async function authenticatedUserId() {
  if (!process.env.AUTH_SECRET && !process.env.NEXTAUTH_SECRET) return null;
  try {
    const session = await getServerSession(authOptions);
    return session?.user?.id || null;
  } catch {
    return null;
  }
}

/**
 * The signed-in user plus the id of this login session (revoked at logout). The session id is what profile unlocks
 * are bound to. It is read from the signed session cookie and never sent to the browser.
 */
export async function authenticatedContext() {
  const userId = await authenticatedUserId();
  if (!userId) return null;
  try {
    const [jar, requestHeaders] = await Promise.all([cookies(), headers()]);
    const token = await getToken({
      req: { cookies: Object.fromEntries(jar.getAll().map((cookie) => [cookie.name, cookie.value])), headers: Object.fromEntries(requestHeaders.entries()) } as never,
      secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
    });
    const sid = typeof token?.sid === 'string' ? token.sid : '';
    return sid ? { userId, sid } : null;
  } catch {
    return null;
  }
}
