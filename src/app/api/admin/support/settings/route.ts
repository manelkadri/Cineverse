import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSupportAdmin } from '@/lib/support-admin';
import { loadAvailability, loadCategories } from '@/lib/support-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PREFERENCE_DEFAULTS = { notifyNewTicket: true, notifyUserReply: true, notifyHighPriority: true, notifyAssigned: true, notifyReopened: true };

// The support settings that can actually be changed: the availability text, the contact-form categories and this
// administrator's own notification preferences.
export async function GET(request: Request) {
  const access = await requireSupportAdmin(request);
  if ('response' in access) return access.response;
  const [availability, categories, preference] = await Promise.all([
    loadAvailability(),
    loadCategories(),
    prisma.supportAdminPreference.findUnique({ where: { userId: access.context.userId }, select: { notifyNewTicket: true, notifyUserReply: true, notifyHighPriority: true, notifyAssigned: true, notifyReopened: true } }),
  ]);
  return NextResponse.json({ availability, categories, preferences: preference ?? PREFERENCE_DEFAULTS }, { headers: { 'Cache-Control': 'no-store' } });
}
