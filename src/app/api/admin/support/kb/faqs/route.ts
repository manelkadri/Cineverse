import { randomBytes } from 'node:crypto';
import { revalidateHelp } from '@/lib/help-revalidate';
import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSupportAdmin } from '@/lib/support-admin';
import { auditEntry } from '@/lib/support-server';
import { loadKnowledgeBaseRows } from '@/lib/kb-server';
import { adminFaqs } from '@/lib/kb-merge';
import { HELP_FAQ } from '@/lib/help-content';
import { kbFaqSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Support staff only. Every question, in the saved display order, with its origin and state.
export async function GET(request: Request) {
  const access = await requireSupportAdmin(request);
  if ('response' in access) return access.response;
  try {
    const { faqs, order } = await loadKnowledgeBaseRows();
    return NextResponse.json({ faqs: adminFaqs(HELP_FAQ, faqs, order) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ faqs: adminFaqs(HELP_FAQ, []), unavailable: true }, { headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function POST(request: Request) {
  const access = await requireSupportAdmin(request, { mutation: true });
  if ('response' in access) return access.response;
  const parsed = kbFaqSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Demande invalide.', code: 'INVALID_REQUEST', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  const input = parsed.data;
  const key = `custom-${randomBytes(5).toString('hex')}`;
  const actorId = access.context.userId;
  await prisma.$transaction([
    prisma.kbFaq.create({ data: { key, question: input.question, answer: input.answer, category: input.category, articleSlug: input.articleSlug || null, links: input.links as unknown as Prisma.InputJsonValue, keywords: input.keywords, status: input.status, updatedById: actorId } }),
    auditEntry(actorId, 'kb.faq_created', 'kb_faq', key, { status: input.status }),
    ...(input.status === 'published' ? [auditEntry(actorId, 'kb.faq_published', 'kb_faq', key)] : []),
  ]);
  revalidateHelp();
  return NextResponse.json({ key }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
