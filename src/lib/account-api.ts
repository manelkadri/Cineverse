import 'server-only';
import { NextResponse } from 'next/server';
import { authenticatedContext } from './server-auth';
import { isAuthRuntimeConfigured } from './auth-security';

/** The signed-in account for an /api/account request, or the error response to send. The account is never taken from the URL or body. */
export async function requireAccount(request: Request, { mutation = false }: { mutation?: boolean } = {}) {
  if (!isAuthRuntimeConfigured()) return { response: NextResponse.json({ error: 'Authentication is not configured' }, { status: 503 }) };
  if (mutation) {
    const crossSite = crossSiteResponse(request);
    if (crossSite) return { response: crossSite };
  }
  const context = await authenticatedContext();
  if (!context) return { response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) };
  return { context };
}

/**
 * CSRF defence for state-changing requests on top of the SameSite=Lax session cookie: a request that declares another
 * origin (Origin header, or Sec-Fetch-Site: cross-site) is refused, and the body must be JSON.
 */
export function crossSiteResponse(request: Request) {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  const origin = request.headers.get('origin');
  let foreign = request.headers.get('sec-fetch-site') === 'cross-site';
  if (origin) {
    try { foreign = foreign || new URL(origin).host !== host; } catch { foreign = true; }
  }
  if (foreign) return NextResponse.json({ error: 'Requête refusée.', code: 'CROSS_SITE' }, { status: 403 });
  // A DELETE with no body (for example removing one support ticket by its address) has no content type to check.
  const hasBody = request.method !== 'DELETE' || Number(request.headers.get('content-length') ?? 0) > 0;
  if (hasBody && !(request.headers.get('content-type') ?? '').includes('application/json')) return NextResponse.json({ error: 'Requête invalide.', code: 'INVALID_REQUEST' }, { status: 415 });
  return null;
}

export const noStore = { 'Cache-Control': 'no-store' };
