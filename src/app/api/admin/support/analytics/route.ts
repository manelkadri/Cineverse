import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSupportAdmin } from '@/lib/support-admin';
import { loadCategories } from '@/lib/support-server';
import { priorityId } from '@/lib/support-meta';
import { adminAnalyticsQuerySchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DAY = 24 * 60 * 60 * 1000;
const UNITS = { day: 'day', week: 'week', month: 'month' } as const; // allowlist: the only values that reach the SQL text

const iso = (date: Date) => date.toISOString().slice(0, 10);

/** Start of the bucket that contains `date`, in UTC (weeks start on Monday, like PostgreSQL's date_trunc). */
function bucketStart(date: Date, unit: keyof typeof UNITS) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  if (unit === 'week') d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  if (unit === 'month') d.setUTCDate(1);
  return d;
}
function nextBucket(date: Date, unit: keyof typeof UNITS) {
  const d = new Date(date);
  if (unit === 'day') d.setUTCDate(d.getUTCDate() + 1);
  else if (unit === 'week') d.setUTCDate(d.getUTCDate() + 7);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

// Support staff only. Every number is computed from stored records. A metric that the data cannot support is reported with
// its sample size (or as unavailable) instead of being estimated.
export async function GET(request: Request) {
  const access = await requireSupportAdmin(request);
  if ('response' in access) return access.response;
  const parsed = adminAnalyticsQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Paramètres invalides.', code: 'INVALID_REQUEST' }, { status: 400 });
  const today = new Date();
  const to = parsed.data.to ?? iso(today);
  const from = parsed.data.from ?? iso(new Date(today.getTime() - 29 * DAY));
  const fromDate = new Date(`${from}T00:00:00.000Z`);
  const toDate = new Date(`${to}T23:59:59.999Z`);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || fromDate > toDate) return NextResponse.json({ error: 'Période invalide.', code: 'INVALID_REQUEST' }, { status: 400 });
  if (toDate.getTime() - fromDate.getTime() > 366 * DAY) return NextResponse.json({ error: 'La période ne peut pas dépasser un an.', code: 'INVALID_REQUEST' }, { status: 400 });
  const unit = parsed.data.granularity;
  const range = { createdAt: { gte: fromDate, lte: toDate } };

  const [total, byStatus, byCategory, byPriority, series, firstResponse, resolution, categories] = await Promise.all([
    prisma.supportTicket.count({ where: range }),
    prisma.supportTicket.groupBy({ by: ['status'], where: range, _count: { _all: true } }),
    prisma.supportTicket.groupBy({ by: ['category'], where: range, _count: { _all: true } }),
    prisma.supportTicket.groupBy({ by: ['priority'], where: range, _count: { _all: true } }),
    prisma.$queryRaw<{ bucket: Date; n: number }[]>(Prisma.sql`SELECT date_trunc(${Prisma.raw(`'${UNITS[unit]}'`)}, "createdAt") AS bucket, count(*)::int AS n FROM "SupportTicket" WHERE "createdAt" >= ${fromDate} AND "createdAt" <= ${toDate} GROUP BY 1 ORDER BY 1`),
    prisma.$queryRaw<{ avg: number | null; n: number }[]>(Prisma.sql`SELECT avg(extract(epoch from ("firstResponseAt" - "createdAt")))::float AS avg, count(*)::int AS n FROM "SupportTicket" WHERE "firstResponseAt" IS NOT NULL AND "createdAt" >= ${fromDate} AND "createdAt" <= ${toDate}`),
    // Resolution time needs the moment a ticket was resolved or closed. That moment is only known for status changes recorded in
    // the audit log, so tickets finished before the audit log existed are (honestly) not part of the sample.
    prisma.$queryRaw<{ avg: number | null; n: number }[]>(Prisma.sql`SELECT avg(extract(epoch from (r.finished_at - t."createdAt")))::float AS avg, count(*)::int AS n FROM "SupportTicket" t JOIN (SELECT "resourceId", min("createdAt") AS finished_at FROM "SupportAuditLog" WHERE action = 'ticket.status_changed' AND metadata->>'to' IN ('resolved', 'closed') GROUP BY "resourceId") r ON r."resourceId" = t.id WHERE t."createdAt" >= ${fromDate} AND t."createdAt" <= ${toDate}`),
    loadCategories(),
  ]);

  // a continuous series: buckets with no ticket are shown as zero, not skipped
  const counts = new Map(series.map((row) => [bucketStart(row.bucket, unit).getTime(), row.n]));
  const points: { date: string; count: number }[] = [];
  for (let cursor = bucketStart(fromDate, unit); cursor <= toDate && points.length < 400; cursor = nextBucket(cursor, unit)) points.push({ date: iso(cursor), count: counts.get(cursor.getTime()) ?? 0 });

  const status = Object.fromEntries(byStatus.map((row) => [row.status, row._count._all])) as Record<string, number>;
  const metric = (row: { avg: number | null; n: number } | undefined) => (row && row.n > 0 && row.avg !== null ? { available: true as const, seconds: Math.round(row.avg), sample: row.n } : { available: false as const, seconds: null, sample: row?.n ?? 0 });
  return NextResponse.json({
    range: { from, to, granularity: unit },
    total,
    byStatus: { open: status.open ?? 0, in_progress: status.in_progress ?? 0, resolved: status.resolved ?? 0, closed: status.closed ?? 0 },
    resolvedVersusUnresolved: { resolved: (status.resolved ?? 0) + (status.closed ?? 0), unresolved: (status.open ?? 0) + (status.in_progress ?? 0) },
    byCategory: byCategory.map((row) => ({ category: row.category, count: row._count._all })).sort((a, b) => b.count - a.count),
    byPriority: byPriority.map((row) => ({ priority: priorityId(row.priority), count: row._count._all })),
    series: points,
    firstResponse: metric(firstResponse[0]),
    resolution: metric(resolution[0]),
    categories: categories.map((category) => ({ id: category.id, label: category.label })),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
