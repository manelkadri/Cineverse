import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAccount } from '@/lib/account-api';
import { loadCategories } from '@/lib/support-server';
import { ticketReference } from '@/lib/support-rules';
import { categoryLabel } from '@/lib/support-meta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The signed-in member's own support requests. The account comes from the session only: a ticket sent without signing in
// is never linked to an account and never appears here, and no ticket of another account can be listed.
export async function GET(request: Request) {
  const access = await requireAccount(request);
  if ('response' in access) return access.response;
  const { userId } = access.context;
  const [tickets, categories] = await Promise.all([
    prisma.supportTicket.findMany({
      where: { userId }, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], take: 50,
      select: { id: true, subject: true, category: true, status: true, createdAt: true, updatedAt: true, messages: { where: { visibility: 'public' }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1, select: { senderType: true } } },
    }),
    loadCategories(),
  ]);
  return NextResponse.json({
    tickets: tickets.map((ticket) => ({
      id: ticket.id, reference: ticketReference(ticket.id), subject: ticket.subject, category: ticket.category, categoryLabel: categoryLabel(categories, ticket.category),
      status: ticket.status, createdAt: ticket.createdAt.toISOString(), updatedAt: ticket.updatedAt.toISOString(),
      // true when the most recent public message came from the support team
      answered: ticket.messages[0]?.senderType === 'staff',
    })),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
