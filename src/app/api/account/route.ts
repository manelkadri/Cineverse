import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { noStore, requireAccount } from '@/lib/account-api';
import { reauthDenied, verifyAccountPassword } from '@/lib/account-reauth';
import { unlockCookieName } from '@/lib/profile-unlock';
import { isSupportAdmin } from '@/lib/support-admin';
import { accountDeleteSchema, accountNameSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The account belongs to the signed-in user only: the id always comes from the session, never from the URL or the body.
// Nothing sensitive is returned (no password hash, no PIN hashes, no session tokens).
export async function GET(request: Request) {
  const access = await requireAccount(request);
  if ('response' in access) return access.response;
  const { userId, sid } = access.context;
  const [user, profiles, sessions] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true, emailVerified: true, createdAt: true } }),
    prisma.profile.findMany({ where: { userId }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true, avatar: true, isKids: true, profilePinHash: true } }),
    prisma.session.findMany({ where: { userId, expires: { gt: new Date() } }, orderBy: { expires: 'desc' }, select: { id: true, sessionToken: true, expires: true } }),
  ]);
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const supportAdmin = await isSupportAdmin(userId);
  return NextResponse.json({
    supportAdmin,
    account: { name: user.name ?? '', email: user.email ?? '', emailVerified: Boolean(user.emailVerified), createdAt: user.createdAt.toISOString() },
    profiles: profiles.map((profile) => ({ id: profile.id, name: profile.name, avatar: profile.avatar, isKids: profile.isKids, hasPin: Boolean(profile.profilePinHash) })),
    sessions: sessions.map((session) => ({ id: session.id, current: session.sessionToken === sid, expires: session.expires.toISOString() })),
  }, { headers: noStore });
}

// Only the name can be changed here (strict schema: no other field is accepted). The e-mail address is the login
// identity and has no confirmation workflow yet, so it is read-only.
export async function PATCH(request: Request) {
  const access = await requireAccount(request, { mutation: true });
  if ('response' in access) return access.response;
  const parsed = accountNameSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Nom invalide.', code: 'INVALID_REQUEST', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  const user = await prisma.user.update({ where: { id: access.context.userId }, data: { name: parsed.data.name }, select: { name: true } });
  return NextResponse.json({ name: user.name ?? '' }, { headers: noStore });
}

// Permanent deletion of the signed-in account. Needs the account password again (rate limited like logins) and the typed
// confirmation word. The database cascades to this user's sessions, profiles, watchlists, favorites, history and progress.
export async function DELETE(request: Request) {
  const access = await requireAccount(request, { mutation: true });
  if ('response' in access) return access.response;
  const body = await request.json().catch(() => null);
  if (typeof body?.password !== 'string' || body.password.length === 0) return NextResponse.json({ error: 'Saisissez votre mot de passe pour supprimer le compte.', code: 'PASSWORD_REQUIRED' }, { status: 400 });
  const parsed = accountDeleteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Saisissez le mot SUPPRIMER pour confirmer.', code: 'CONFIRMATION_REQUIRED' }, { status: 400 });
  const denied = reauthDenied(await verifyAccountPassword(access.context.userId, parsed.data.password, request.headers));
  if (denied) return denied;
  await prisma.user.delete({ where: { id: access.context.userId } });
  const response = NextResponse.json({ deleted: true }, { headers: noStore });
  response.cookies.delete(unlockCookieName());
  return response;
}
