import 'server-only';
import { NextResponse } from 'next/server';
import { prisma } from './prisma';
import { authenticatedContext } from './server-auth';
import { crossSiteResponse } from './account-api';
import { isAuthRuntimeConfigured } from './auth-security';
import { adminStatus } from './support-rules';

/**
 * Whether this account is support staff, read from the database on every call (never from the session token or the
 * request). The flag cannot be set through the app: the site owner grants it with scripts/grant-support-admin.mjs.
 * Fails closed: if the check itself cannot run, the answer is "unavailable" (and the failure is logged without any
 * account data), never "admin".
 */
export async function supportAdminStatus(userId: string) {
  const status = await adminStatus(() => prisma.user.findUnique({ where: { id: userId }, select: { isSupportAdmin: true } }));
  if (status === 'unavailable') console.error('[support-admin] the authorization lookup failed: the database column or the generated Prisma client may be out of date (apply the migration and restart the server)');
  return status;
}

/** Boolean form for places that only decorate the UI (the account page link): anything but a confirmed admin is false. */
export async function isSupportAdmin(userId: string) {
  return (await supportAdminStatus(userId)) === 'admin';
}

/**
 * Gate for every /api/admin/support request: 401 when signed out, a plain 404 (not 403) for everyone who is not support
 * staff, so the existence of the admin area is not revealed to ordinary accounts, and a 503 when the check itself failed,
 * so a broken check is not mistaken for a refusal. Access is denied in all three cases.
 */
export async function requireSupportAdmin(request: Request, { mutation = false }: { mutation?: boolean } = {}) {
  if (!isAuthRuntimeConfigured()) return { response: NextResponse.json({ error: 'Authentication is not configured' }, { status: 503 }) };
  if (mutation) {
    const blocked = crossSiteResponse(request);
    if (blocked) return { response: blocked };
  }
  const context = await authenticatedContext();
  if (!context) return { response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) };
  const status = await supportAdminStatus(context.userId);
  if (status === 'unavailable') return { response: NextResponse.json({ error: 'Impossible de vérifier vos droits pour le moment.', code: 'ADMIN_CHECK_FAILED' }, { status: 503 }) };
  if (status !== 'admin') return { response: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  return { context };
}

export const ticketReference = (id: string) => `CV-${id.slice(-8).toUpperCase()}`;
