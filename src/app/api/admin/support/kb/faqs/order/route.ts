import { NextResponse } from 'next/server';
import { revalidateHelp } from '@/lib/help-revalidate';
import { prisma } from '@/lib/prisma';
import { requireSupportAdmin } from '@/lib/support-admin';
import { auditEntry } from '@/lib/support-server';
import { loadKnowledgeBaseRows } from '@/lib/kb-server';
import { adminFaqs } from '@/lib/kb-merge';
import { HELP_FAQ } from '@/lib/help-content';
import { kbFaqOrderSchema } from '@/lib/validation';

export const runtime = 'nodejs';

// Saves the display order of the questions as a list of keys in the support settings (so reordering a built-in question does
// not need to copy it). Every key must be an existing question, with no repeat.
export async function PUT(request: Request) {
  const access = await requireSupportAdmin(request, { mutation: true });
  if ('response' in access) return access.response;
  const parsed = kbFaqOrderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Demande invalide.', code: 'INVALID_REQUEST' }, { status: 400 });
  const { keys } = parsed.data;
  const { faqs } = await loadKnowledgeBaseRows();
  const known = new Set(adminFaqs(HELP_FAQ, faqs).map((faq) => faq.key));
  if (new Set(keys).size !== keys.length || keys.some((key) => !known.has(key))) return NextResponse.json({ error: 'Liste de questions invalide.', code: 'INVALID_REQUEST' }, { status: 400 });
  const actorId = access.context.userId;
  await prisma.$transaction([
    prisma.supportSetting.upsert({ where: { key: 'faq-order' }, create: { key: 'faq-order', value: keys, updatedById: actorId }, update: { value: keys, updatedById: actorId } }),
    auditEntry(actorId, 'kb.faq_reordered', 'kb_faq', 'order', { count: keys.length }),
  ]);
  revalidateHelp();
  return NextResponse.json({ saved: true }, { headers: { 'Cache-Control': 'no-store' } });
}
