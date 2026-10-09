import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSupportAdmin } from '@/lib/support-admin';
import { presentTicket, ticketSelect } from '@/lib/support-server';
import { priorityLevel } from '@/lib/support-meta';
import { adminTicketListQuerySchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ACTIVE = ['open', 'in_progress'];
const dayStart = (day: string) => new Date(`${day}T00:00:00.000Z`);
const dayEnd = (day: string) => new Date(`${day}T23:59:59.999Z`);

// Support staff only (see requireSupportAdmin). Server-side search, filters, sorting and pagination.
export async function GET(request: Request) {
  const access = await requireSupportAdmin(request);
  if ('response' in access) return access.response;
  const parsed = adminTicketListQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Paramètres invalides.', code: 'INVALID_REQUEST' }, { status: 400 });
  const q = parsed.data;
  if (q.from && q.to && q.from > q.to) return NextResponse.json({ error: 'La date de début doit précéder la date de fin.', code: 'INVALID_REQUEST' }, { status: 400 });

  const and: Prisma.SupportTicketWhereInput[] = [];
  if (q.status) and.push({ status: q.status });
  if (q.category) and.push({ category: q.category });
  if (q.priority) and.push({ priority: priorityLevel(q.priority) });
  if (q.assignee === 'me') and.push({ assignedToId: access.context.userId });
  else if (q.assignee === 'unassigned') and.push({ assignedToId: null });
  else if (q.assignee) and.push({ assignedToId: q.assignee });
  if (q.attention) and.push({ awaitingStaff: true, status: { in: ACTIVE } });
  if (q.from) and.push({ createdAt: { gte: dayStart(q.from) } });
  if (q.to) and.push({ createdAt: { lte: dayEnd(q.to) } });
  if (q.q) {
    // a reference such as "CV-AB12CD34" is the end of the ticket id; subject and e-mail are searched as text
    const reference = q.q.match(/^cv-?([0-9a-z]{4,8})$/i);
    and.push({ OR: [
      { subject: { contains: q.q, mode: 'insensitive' } },
      { email: { contains: q.q, mode: 'insensitive' } },
      ...(reference ? [{ id: { endsWith: reference[1].toLowerCase() } }] : []),
    ] });
  }
  const where: Prisma.SupportTicketWhereInput = and.length ? { AND: and } : {};
  const orderBy: Prisma.SupportTicketOrderByWithRelationInput[] =
    q.sort === 'oldest' ? [{ createdAt: 'asc' }, { id: 'asc' }]
      : q.sort === 'priority' ? [{ priority: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]
        : q.sort === 'updated' ? [{ updatedAt: 'desc' }, { id: 'desc' }]
          : [{ createdAt: 'desc' }, { id: 'desc' }];

  const [rows, total, grouped, toHandle] = await Promise.all([
    prisma.supportTicket.findMany({ where, orderBy, skip: (q.page - 1) * q.pageSize, take: q.pageSize, select: ticketSelect }),
    prisma.supportTicket.count({ where }),
    prisma.supportTicket.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.supportTicket.count({ where: { awaitingStaff: true, status: { in: ACTIVE } } }),
  ]);
  return NextResponse.json({
    tickets: rows.map((row) => {
      const { message, ...ticket } = presentTicket(row);
      return { ...ticket, preview: message.length > 140 ? `${message.slice(0, 140)}…` : message };
    }),
    total, page: q.page, pageSize: q.pageSize,
    counts: Object.fromEntries(grouped.map((group) => [group.status, group._count._all])),
    toHandle,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
