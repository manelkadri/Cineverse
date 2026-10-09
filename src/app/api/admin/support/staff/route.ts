import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSupportAdmin } from '@/lib/support-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The support administrators (the only accounts a ticket can be assigned to), with their open workload. Administrator
// access itself can only be granted by the site owner with scripts/grant-support-admin.mjs: this list is read-only.
export async function GET(request: Request) {
  const access = await requireSupportAdmin(request);
  if ('response' in access) return access.response;
  const [admins, workload] = await Promise.all([
    prisma.user.findMany({ where: { isSupportAdmin: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }], select: { id: true, name: true, email: true, createdAt: true } }),
    prisma.supportTicket.groupBy({ by: ['assignedToId'], where: { assignedToId: { not: null }, status: { in: ['open', 'in_progress'] } }, _count: { _all: true } }),
  ]);
  const load = new Map(workload.map((row) => [row.assignedToId, row._count._all]));
  return NextResponse.json({
    staff: admins.map((admin) => ({ id: admin.id, name: admin.name ?? 'Administrateur', email: admin.email ?? '', role: 'Administrateur du support', openAssigned: load.get(admin.id) ?? 0, you: admin.id === access.context.userId })),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
