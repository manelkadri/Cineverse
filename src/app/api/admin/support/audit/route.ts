import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSupportAdmin } from '@/lib/support-admin';
import { adminAuditQuerySchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

// Support staff only, read-only: there is no route that edits or deletes an audit entry, and the database refuses it too.
export async function GET(request: Request) {
  const access = await requireSupportAdmin(request);
  if ('response' in access) return access.response;
  const parsed = adminAuditQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Paramètres invalides.', code: 'INVALID_REQUEST' }, { status: 400 });
  const where = parsed.data.action ? { action: { startsWith: parsed.data.action } } : {};
  const [entries, total] = await Promise.all([
    prisma.supportAuditLog.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (parsed.data.page - 1) * PAGE_SIZE, take: PAGE_SIZE, select: { id: true, action: true, resourceType: true, resourceId: true, metadata: true, createdAt: true, actor: { select: { name: true } } } }),
    prisma.supportAuditLog.count({ where }),
  ]);
  return NextResponse.json({
    entries: entries.map((entry) => ({ id: entry.id, action: entry.action, resourceType: entry.resourceType, resourceId: entry.resourceId, metadata: entry.metadata, createdAt: entry.createdAt.toISOString(), actorName: entry.actor?.name ?? 'Compte supprimé' })),
    total, page: parsed.data.page, pageSize: PAGE_SIZE,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
