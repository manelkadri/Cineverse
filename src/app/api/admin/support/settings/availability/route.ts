import { NextResponse } from 'next/server';
import { revalidateHelp } from '@/lib/help-revalidate';
import { prisma } from '@/lib/prisma';
import { requireSupportAdmin } from '@/lib/support-admin';
import { auditEntry } from '@/lib/support-server';
import { supportAvailabilitySchema } from '@/lib/validation';

export const runtime = 'nodejs';

// Sets the support availability text shown on the Help Center. Nothing is shown to visitors until an administrator
// explicitly saves and enables it here: business hours or response times are never invented.
export async function PUT(request: Request) {
  const access = await requireSupportAdmin(request, { mutation: true });
  if ('response' in access) return access.response;
  const parsed = supportAvailabilitySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Demande invalide.', code: 'INVALID_REQUEST', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  const value = { enabled: parsed.data.enabled, text: parsed.data.text };
  const actorId = access.context.userId;
  await prisma.$transaction([
    prisma.supportSetting.upsert({ where: { key: 'availability' }, create: { key: 'availability', value, updatedById: actorId }, update: { value, updatedById: actorId } }),
    auditEntry(actorId, 'settings.availability_changed', 'settings', 'availability', { enabled: value.enabled }),
  ]);
  revalidateHelp();
  return NextResponse.json({ availability: value }, { headers: { 'Cache-Control': 'no-store' } });
}
