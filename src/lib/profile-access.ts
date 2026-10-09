import 'server-only';
import { prisma } from './prisma';
import { getMediaDetails } from './tmdb';
import { parseMediaId } from './media-id';
import { NextResponse } from 'next/server';
import { authenticatedContext } from './server-auth';
import { unlockedProfileId } from './profile-unlock';

export async function ownedProfile(userId: string, profileId: string) {
  return prisma.profile.findFirst({ where: { id: profileId, userId } });
}

export async function ensureProfileMediaAllowed(profile: { isKids: boolean; maturityLevel: number }, mediaId: string) {
  if (!profile.isKids) return true;
  const parsed = parseMediaId(mediaId);
  if (!parsed) return false;
  const details = await getMediaDetails(parsed.mediaType, parsed.tmdbId);
  return details.maturityLevel <= profile.maturityLevel;
}

export async function activeProfileAccess(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { selectedProfileId: true } });
  if (!user?.selectedProfileId) return null;
  return prisma.profile.findFirst({ where: { id: user.selectedProfileId, userId }, select: { id: true, isKids: true, maturityLevel: true } });
}

// ---- Profile PIN protection -------------------------------------------------------------------------------------
/**
 * Gate for every route that reads or changes a profile's personal data. The profile must belong to the signed-in user
 * AND be the one unlocked (PIN verified) in this login session. A profile id sent by the client proves nothing.
 */
export async function requireUnlockedProfile(profileId: string) {
  const context = await authenticatedContext();
  if (!context) return { response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) } as const;
  const profile = await ownedProfile(context.userId, profileId);
  if (!profile) return { response: NextResponse.json({ error: 'Profile not found' }, { status: 404 }) } as const;
  if ((await unlockedProfileId(context)) !== profile.id) {
    return {
      response: NextResponse.json(
        profile.profilePinHash
          ? { error: 'Profil verrouillé. Saisissez le code PIN.', code: 'PROFILE_LOCKED' }
          : { error: 'Définissez un code PIN pour ce profil.', code: 'PIN_SETUP_REQUIRED' },
        { status: 403 },
      ),
    } as const;
  }
  return { context, profile } as const;
}
