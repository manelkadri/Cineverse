import 'server-only';
import { NextResponse } from 'next/server';
import { prisma } from './prisma';
import { profileInclude, toClientProfile } from './profile-db';
import { signUnlock, unlockCookieName, unlockCookieOptions } from './profile-unlock';

/**
 * Marks `profileId` as the unlocked profile of this login session and as the user's selected profile, then answers with
 * that profile's data. Any previously unlocked profile is replaced, so switching profiles always needs its PIN.
 */
export async function grantProfileUnlock(context: { userId: string; sid: string }, profileId: string) {
  const [profile] = await Promise.all([
    prisma.profile.findFirstOrThrow({ where: { id: profileId, userId: context.userId }, include: profileInclude }),
    prisma.user.update({ where: { id: context.userId }, data: { selectedProfileId: profileId } }),
  ]);
  const response = NextResponse.json({ unlocked: true, profile: toClientProfile(profile), selectedProfileId: profile.id });
  response.cookies.set(unlockCookieName(), signUnlock({ sid: context.sid, userId: context.userId, profileId: profile.id }), unlockCookieOptions());
  return response;
}
