import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAccount } from '@/lib/account-api';
import { loadCategories } from '@/lib/support-server';
import { ticketReference } from '@/lib/support-rules';
import { categoryLabel } from '@/lib/support-meta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// One of the member's own tickets with its PUBLIC conversation. Ownership is part of the query, so another account's ticket
// looks like a ticket that does not exist. Private staff notes, the legacy internal note, priority and assignment are never
// selected, and staff members appear only as "Équipe de support".
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireAccount(request);
  if ('response' in access) return access.response;
  const { id } = await params;
  const ticket = await prisma.supportTicket.findFirst({
    where: { id, userId: access.context.userId },
    select: {
      id: true, subject: true, category: true, status: true, message: true, createdAt: true, updatedAt: true,
      messages: { where: { visibility: 'public' }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 500, select: { id: true, senderType: true, body: true, createdAt: true } },
    },
  });
  if (!ticket) return NextResponse.json({ error: 'Demande introuvable.', code: 'NOT_FOUND' }, { status: 404 });
  const categories = await loadCategories();
  return NextResponse.json({
    ticket: { id: ticket.id, reference: ticketReference(ticket.id), subject: ticket.subject, category: ticket.category, categoryLabel: categoryLabel(categories, ticket.category), status: ticket.status, createdAt: ticket.createdAt.toISOString(), updatedAt: ticket.updatedAt.toISOString() },
    messages: [
      { id: `${ticket.id}-first`, senderType: 'user', body: ticket.message, createdAt: ticket.createdAt.toISOString(), authorName: null },
      ...ticket.messages.map((message) => ({ id: message.id, senderType: message.senderType, body: message.body, createdAt: message.createdAt.toISOString(), authorName: message.senderType === 'staff' ? 'Équipe de support' : null })),
    ],
  }, { headers: { 'Cache-Control': 'no-store' } });
}
