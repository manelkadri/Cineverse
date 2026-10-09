import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { noStore, requireAccount } from '@/lib/account-api';
import { unlockCookieName } from '@/lib/profile-unlock';
import { sessionRevokeSchema } from '@/lib/validation';

export const runtime = 'nodejs';

// Revokes login sessions of the signed-in account only (ownership is part of every query).
//  { sessionId } revokes one OTHER session, { scope: 'others' } revokes every other session,
//  { scope: 'all' } signs out everywhere including this device (the client then leaves the site).
// Signing out here does not need the password: it only reduces access. A revoked session stops working immediately
// because the session check looks the row up on every request.
export async function DELETE(request: Request) {
  const access = await requireAccount(request, { mutation: true });
  if ('response' in access) return access.response;
  const { userId, sid } = access.context;
  const parsed = sessionRevokeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Demande invalide.', code: 'INVALID_REQUEST' }, { status: 400 });
  if ('sessionId' in parsed.data) {
    const target = await prisma.session.findFirst({ where: { id: parsed.data.sessionId, userId }, select: { id: true, sessionToken: true } });
    if (!target) return NextResponse.json({ error: 'Session introuvable.', code: 'NOT_FOUND' }, { status: 404 });
    if (target.sessionToken === sid) return NextResponse.json({ error: 'Utilisez « Se déconnecter » pour fermer cette session.', code: 'CURRENT_SESSION' }, { status: 400 });
    await prisma.session.delete({ where: { id: target.id } });
    return NextResponse.json({ revoked: 1 }, { headers: noStore });
  }
  const all = parsed.data.scope === 'all';
  const result = await prisma.session.deleteMany({ where: { userId, ...(all ? {} : { sessionToken: { not: sid } }) } });
  const response = NextResponse.json({ revoked: result.count, signedOut: all }, { headers: noStore });
  if (all) response.cookies.delete(unlockCookieName());
  return response;
}
