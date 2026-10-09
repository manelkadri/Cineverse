import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSupportAdmin } from '@/lib/support-admin';
import { supportAdminPreferenceSchema } from '@/lib/validation';

export const runtime = 'nodejs';

const select = { notifyNewTicket: true, notifyUserReply: true, notifyHighPriority: true, notifyAssigned: true, notifyReopened: true } as const;

// Which support events notify THIS administrator. Each administrator only ever changes their own preferences.
export async function PUT(request: Request) {
  const access = await requireSupportAdmin(request, { mutation: true });
  if ('response' in access) return access.response;
  const parsed = supportAdminPreferenceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Demande invalide.', code: 'INVALID_REQUEST' }, { status: 400 });
  const userId = access.context.userId;
  const preference = await prisma.supportAdminPreference.upsert({ where: { userId }, create: { userId, ...parsed.data }, update: parsed.data, select });
  return NextResponse.json({ preferences: preference }, { headers: { 'Cache-Control': 'no-store' } });
}
