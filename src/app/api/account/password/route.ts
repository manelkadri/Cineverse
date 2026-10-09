import { hash } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { noStore, requireAccount } from '@/lib/account-api';
import { reauthDenied, verifyAccountPassword } from '@/lib/account-reauth';
import { passwordChangeSchema } from '@/lib/validation';

export const runtime = 'nodejs';

// Changes the account password. The current password is verified first (failures count toward the same persistent
// lockout as logins). The new password is hashed with bcrypt cost 12 like at registration. Every OTHER login session is
// revoked, so a stolen or forgotten device is signed out; the session making the change stays signed in.
export async function POST(request: Request) {
  const access = await requireAccount(request, { mutation: true });
  if ('response' in access) return access.response;
  const { userId, sid } = access.context;
  const body = await request.json().catch(() => null);
  if (typeof body?.currentPassword !== 'string' || body.currentPassword.length === 0) return NextResponse.json({ error: 'Saisissez votre mot de passe actuel.', code: 'PASSWORD_REQUIRED' }, { status: 400 });
  const parsed = passwordChangeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Données invalides.', code: 'INVALID_PASSWORD', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  const denied = reauthDenied(await verifyAccountPassword(userId, parsed.data.currentPassword, request.headers));
  if (denied) return denied;
  const passwordHash = await hash(parsed.data.newPassword, 12);
  const [, revoked] = await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    prisma.session.deleteMany({ where: { userId, sessionToken: { not: sid } } }),
  ]);
  return NextResponse.json({ changed: true, otherSessionsRevoked: revoked.count }, { headers: noStore });
}
