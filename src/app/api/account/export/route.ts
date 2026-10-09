import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAccount } from '@/lib/account-api';
import { reauthDenied, verifyAccountPassword } from '@/lib/account-reauth';
import { accountExportSchema } from '@/lib/validation';

export const runtime = 'nodejs';

// Downloads the signed-in account's personal data as JSON. It contains personal data, so the account password is asked
// again (rate limited like logins). Password hash, PIN hashes and session tokens are never included.
export async function POST(request: Request) {
  const access = await requireAccount(request, { mutation: true });
  if ('response' in access) return access.response;
  const { userId } = access.context;
  const body = await request.json().catch(() => null);
  if (typeof body?.password !== 'string' || body.password.length === 0) return NextResponse.json({ error: 'Saisissez votre mot de passe pour télécharger vos données.', code: 'PASSWORD_REQUIRED' }, { status: 400 });
  const parsed = accountExportSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Demande invalide.', code: 'INVALID_REQUEST' }, { status: 400 });
  const denied = reauthDenied(await verifyAccountPassword(userId, parsed.data.password, request.headers));
  if (denied) return denied;
  const [user, profiles, sessions] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, emailVerified: true, createdAt: true, updatedAt: true } }),
    prisma.profile.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, name: true, avatar: true, isKids: true, maturityLevel: true, preferences: true, language: true, createdAt: true,
        profilePinHash: true, parentalPinHash: true,
        watchlist: { select: { mediaId: true, addedAt: true } },
        favorites: { select: { mediaId: true, addedAt: true } },
        viewingHistory: { select: { mediaId: true, seasonNumber: true, episodeNumber: true, positionSeconds: true, durationSeconds: true, completed: true, lastWatchedAt: true } },
        watchProgress: { select: { mediaId: true, seasonNumber: true, episodeNumber: true, positionSeconds: true, durationSeconds: true, completed: true, updatedAt: true } },
      },
    }),
    prisma.session.count({ where: { userId, expires: { gt: new Date() } } }),
  ]);
  const data = {
    exportedAt: new Date().toISOString(),
    account: user,
    activeSessions: sessions,
    profiles: profiles.map(({ profilePinHash, parentalPinHash, ...profile }) => ({ ...profile, pinProtected: Boolean(profilePinHash), parentalCodeSet: Boolean(parentalPinHash) })),
  };
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename="cineverse-mes-donnees.json"', 'Cache-Control': 'no-store' },
  });
}
