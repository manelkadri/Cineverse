import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticatedContext } from '@/lib/server-auth';
import { isAuthRuntimeConfigured } from '@/lib/auth-security';
import { requireUnlockedProfile } from '@/lib/profile-access';
import { unlockCookieName } from '@/lib/profile-unlock';
import { profileSelectionSchema } from '@/lib/validation';

export const runtime = 'nodejs';

// Selecting a profile is only possible once its PIN was verified in this login session (POST /api/profiles/[id]/unlock
// does that and selects it). Passing null leaves the current profile: it clears the selection and the unlock.
export async function PUT(request: Request) {
  if (!isAuthRuntimeConfigured()) return NextResponse.json({ error: 'Database authentication is not configured' }, { status: 503 });
  const context = await authenticatedContext();
  if (!context) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const parsed = profileSelectionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid profile selection' }, { status: 400 });
  const { profileId } = parsed.data;
  if (profileId === null) {
    await prisma.user.update({ where: { id: context.userId }, data: { selectedProfileId: null } });
    const response = NextResponse.json({ selectedProfileId: null });
    response.cookies.delete(unlockCookieName());
    return response;
  }
  const gate = await requireUnlockedProfile(profileId);
  if ('response' in gate) return gate.response;
  await prisma.user.update({ where: { id: context.userId }, data: { selectedProfileId: gate.profile.id } });
  return NextResponse.json({ selectedProfileId: gate.profile.id });
}
