import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSupportAdmin, ticketReference } from '@/lib/support-admin';
import { SUPPORT_CATEGORY_IDS, SUPPORT_STATUS_IDS } from '@/lib/support-rules';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

// Support staff only (see requireSupportAdmin). Lists tickets, newest first, optionally by status and category.
export async function GET(request: Request) {
  const access = await requireSupportAdmin(request);
  if ('response' in access) return access.response;
  const params = new URL(request.url).searchParams;
  const status = SUPPORT_STATUS_IDS.find((id) => id === params.get('status'));
  const category = SUPPORT_CATEGORY_IDS.find((id) => id === params.get('category'));
  const page = Math.max(1, Math.min(10_000, Number.parseInt(params.get('page') ?? '1', 10) || 1));
  const where = { ...(status ? { status } : {}), ...(category ? { category } : {}) };
  const [tickets, total, grouped] = await Promise.all([
    prisma.supportTicket.findMany({
      where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
      select: { id: true, userId: true, email: true, subject: true, category: true, message: true, status: true, adminNote: true, createdAt: true, updatedAt: true },
    }),
    prisma.supportTicket.count({ where }),
    prisma.supportTicket.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);
  return NextResponse.json({
    tickets: tickets.map(({ userId, ...ticket }) => ({ ...ticket, reference: ticketReference(ticket.id), accountLinked: userId !== null })),
    total, page, pageSize: PAGE_SIZE,
    counts: Object.fromEntries(grouped.map((group) => [group.status, group._count._all])),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
