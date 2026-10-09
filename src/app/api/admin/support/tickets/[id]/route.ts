import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSupportAdmin, ticketReference } from '@/lib/support-admin';
import { supportTicketPatchSchema } from '@/lib/validation';

export const runtime = 'nodejs';

const select = { id: true, userId: true, email: true, subject: true, category: true, message: true, status: true, adminNote: true, createdAt: true, updatedAt: true } as const;
const present = ({ userId, ...ticket }: { id: string; userId: string | null }) => ({ ...ticket, reference: ticketReference(ticket.id), accountLinked: userId !== null });

// Support staff only. Only the status and the internal note can be changed; the visitor's text is never edited.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireSupportAdmin(request, { mutation: true });
  if ('response' in access) return access.response;
  const parsed = supportTicketPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Demande invalide.', code: 'INVALID_REQUEST' }, { status: 400 });
  const { id } = await params;
  const existing = await prisma.supportTicket.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: 'Ticket introuvable.', code: 'NOT_FOUND' }, { status: 404 });
  const ticket = await prisma.supportTicket.update({ where: { id }, data: parsed.data, select });
  return NextResponse.json({ ticket: present(ticket) }, { headers: { 'Cache-Control': 'no-store' } });
}

// Permanently erases one ticket (for example when its author asks for their data to be removed).
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireSupportAdmin(request, { mutation: true });
  if ('response' in access) return access.response;
  const { id } = await params;
  const result = await prisma.supportTicket.deleteMany({ where: { id } });
  if (result.count === 0) return NextResponse.json({ error: 'Ticket introuvable.', code: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json({ deleted: true }, { headers: { 'Cache-Control': 'no-store' } });
}
