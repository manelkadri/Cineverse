import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSupportAdmin } from '@/lib/support-admin';
import { notificationsFailure } from '@/lib/notifications';
import { auditEntry } from '@/lib/support-server';
import { announcementSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HOUR = 60 * 60 * 1000;
const PER_ADMIN_PER_HOUR = 5;
const PER_DAY_OVERALL = 30;
const CHUNK = 500;

// Support staff only (same gate as the ticket area). Lists the announcements already sent, with how many accounts
// received and read each one.
export async function GET(request: Request) {
  const access = await requireSupportAdmin(request);
  if ('response' in access) return access.response;
  try {
    const announcements = await prisma.announcement.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 50, select: { id: true, category: true, title: true, message: true, href: true, recipientCount: true, createdAt: true } });
    const reads = announcements.length
      ? await prisma.notification.groupBy({ by: ['announcementId'], where: { announcementId: { in: announcements.map((item) => item.id) }, readAt: { not: null } }, _count: { _all: true } })
      : [];
    const readBy = new Map(reads.map((row) => [row.announcementId, row._count._all]));
    return NextResponse.json({ announcements: announcements.map((item) => ({ ...item, createdAt: item.createdAt.toISOString(), readCount: readBy.get(item.id) ?? 0 })) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return notificationsFailure(error);
  }
}

// Sends one announcement to EVERY account that accepts its category (catalogue or service news). This is the only way to
// notify many accounts at once, and it is limited to support staff, rate limited, and refuses duplicates.
export async function POST(request: Request) {
  const access = await requireSupportAdmin(request, { mutation: true });
  if ('response' in access) return access.response;
  const parsed = announcementSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Demande invalide.', code: 'INVALID_REQUEST', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  const input = parsed.data;
  const adminId = access.context.userId;
  try {
    const duplicate = await prisma.announcement.count({ where: { title: input.title, message: input.message, createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) } } });
    if (duplicate > 0) return NextResponse.json({ error: 'Cette annonce vient déjà d’être envoyée.', code: 'DUPLICATE' }, { status: 409 });

    // Reserve, then verify by rank (as for support tickets), so two simultaneous sends cannot both pass a limit.
    const announcement = await prisma.announcement.create({ data: { createdById: adminId, category: input.category, title: input.title, message: input.message, href: input.href || null }, select: { id: true, createdAt: true } });
    const earlier = { OR: [{ createdAt: { lt: announcement.createdAt } }, { createdAt: announcement.createdAt, id: { lt: announcement.id } }] };
    const byAdmin = await prisma.announcement.count({ where: { createdById: adminId, createdAt: { gte: new Date(Date.now() - HOUR) }, AND: [earlier] } });
    const overall = await prisma.announcement.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * HOUR) }, AND: [earlier] } });
    if (byAdmin >= PER_ADMIN_PER_HOUR || overall >= PER_DAY_OVERALL) {
      await prisma.announcement.delete({ where: { id: announcement.id } });
      return NextResponse.json({ error: 'Trop d’annonces envoyées récemment. Réessayez plus tard.', code: 'RATE_LIMITED' }, { status: 429, headers: { 'Retry-After': '3600' } });
    }

    const preference = input.category === 'catalogue' ? { notifyCatalogue: true } : { notifyService: true };
    let recipients = 0;
    let cursor: string | undefined;
    try {
      for (;;) {
        const users = await prisma.user.findMany({ where: preference, select: { id: true }, orderBy: { id: 'asc' }, take: CHUNK, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
        if (users.length === 0) break;
        const created = await prisma.notification.createMany({
          data: users.map((user) => ({ userId: user.id, category: input.category, type: 'announcement', title: input.title, message: input.message, href: input.href || null, dedupeKey: `announcement:${announcement.id}`, announcementId: announcement.id })),
          skipDuplicates: true,
        });
        recipients += created.count;
        cursor = users[users.length - 1].id;
        if (users.length < CHUNK) break;
      }
    } catch (error) {
      await prisma.announcement.delete({ where: { id: announcement.id } }).catch(() => undefined); // withdraws any partial delivery
      throw error;
    }
    await prisma.$transaction([
      prisma.announcement.update({ where: { id: announcement.id }, data: { recipientCount: recipients } }),
      auditEntry(adminId, 'announcement.sent', 'announcement', announcement.id, { category: input.category, recipients }),
    ]);
    return NextResponse.json({ announcement: { id: announcement.id, category: input.category, title: input.title, message: input.message, href: input.href || null, recipientCount: recipients, readCount: 0, createdAt: announcement.createdAt.toISOString() } }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return notificationsFailure(error);
  }
}
