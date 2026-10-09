import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSupportAdmin } from '@/lib/support-admin';
import { loadCategories, presentTicket, ticketSelect } from '@/lib/support-server';
import { priorityId } from '@/lib/support-meta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ACTIVE = ['open', 'in_progress'];

// Everything on the overview comes straight from the database: counters, recent and urgent tickets, distributions and the
// latest administrative activity.
export async function GET(request: Request) {
  const access = await requireSupportAdmin(request);
  if ('response' in access) return access.response;
  const lite = (row: Parameters<typeof presentTicket>[0]) => {
    const { message, email, adminNote, ...ticket } = presentTicket(row);
    void message; void email; void adminNote;
    return ticket;
  };
  const [byStatus, toHandle, recent, attention, high, activity, byCategory, byPriority, categories] = await Promise.all([
    prisma.supportTicket.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.supportTicket.count({ where: { awaitingStaff: true, status: { in: ACTIVE } } }),
    prisma.supportTicket.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 6, select: ticketSelect }),
    prisma.supportTicket.findMany({ where: { awaitingStaff: true, status: { in: ACTIVE } }, orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }], take: 6, select: ticketSelect }),
    prisma.supportTicket.findMany({ where: { priority: { gte: 2 }, status: { in: ACTIVE } }, orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }], take: 6, select: ticketSelect }),
    prisma.supportAuditLog.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 8, select: { id: true, action: true, resourceType: true, resourceId: true, metadata: true, createdAt: true, actor: { select: { name: true } } } }),
    prisma.supportTicket.groupBy({ by: ['category'], _count: { _all: true } }),
    prisma.supportTicket.groupBy({ by: ['priority'], _count: { _all: true } }),
    loadCategories(),
  ]);
  const status = Object.fromEntries(byStatus.map((row) => [row.status, row._count._all])) as Record<string, number>;
  const total = byStatus.reduce((sum, row) => sum + row._count._all, 0);
  return NextResponse.json({
    kpis: { total, open: status.open ?? 0, in_progress: status.in_progress ?? 0, resolved: status.resolved ?? 0, closed: status.closed ?? 0, toHandle },
    recent: recent.map(lite),
    attention: attention.map(lite),
    highPriority: high.map(lite),
    activity: activity.map((entry) => ({ id: entry.id, action: entry.action, resourceType: entry.resourceType, resourceId: entry.resourceId, createdAt: entry.createdAt.toISOString(), actorName: entry.actor?.name ?? 'Compte supprimé' })),
    byCategory: byCategory.map((row) => ({ category: row.category, count: row._count._all })).sort((a, b) => b.count - a.count),
    byPriority: byPriority.map((row) => ({ priority: priorityId(row.priority), count: row._count._all })),
    categories: categories.map((category) => ({ id: category.id, label: category.label })),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
