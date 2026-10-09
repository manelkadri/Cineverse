import { NextResponse } from 'next/server';
import { revalidateHelp } from '@/lib/help-revalidate';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSupportAdmin } from '@/lib/support-admin';
import { auditEntry } from '@/lib/support-server';
import { loadKnowledgeBaseRows } from '@/lib/kb-server';
import { adminFaqs, type AdminFaq } from '@/lib/kb-merge';
import { HELP_FAQ } from '@/lib/help-content';
import { kbFaqSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const statusSchema = z.object({ status: z.enum(['draft', 'published', 'archived']) }).strict();

async function find(key: string): Promise<AdminFaq | undefined> {
  let rows: Awaited<ReturnType<typeof loadKnowledgeBaseRows>>['faqs'] = [];
  try { rows = (await loadKnowledgeBaseRows()).faqs; } catch { /* only built-in questions are available */ }
  return adminFaqs(HELP_FAQ, rows).find((faq) => faq.key === key);
}
const currentStatus = (faq: AdminFaq) => (faq.overridden || faq.origin === 'custom' ? (faq.state === 'hidden' ? 'archived' : faq.state) : 'published');
const statusAudit = (from: string, to: string) => (to === 'published' ? 'kb.faq_published' as const : from === 'published' ? 'kb.faq_unpublished' as const : null);

// Saves a question. For a built-in question the first save stores an override (live once published; a draft keeps the
// built-in text live).
export async function PUT(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const access = await requireSupportAdmin(request, { mutation: true });
  if ('response' in access) return access.response;
  const { key } = await params;
  const current = await find(key);
  if (!current) return NextResponse.json({ error: 'Question introuvable.', code: 'NOT_FOUND' }, { status: 404 });
  const parsed = kbFaqSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Demande invalide.', code: 'INVALID_REQUEST', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  const input = parsed.data;
  const actorId = access.context.userId;
  const from = currentStatus(current);
  const data = { question: input.question, answer: input.answer, category: input.category, articleSlug: input.articleSlug || null, links: input.links as unknown as Prisma.InputJsonValue, keywords: input.keywords, status: input.status, updatedById: actorId };
  const extra = statusAudit(from, input.status);
  await prisma.$transaction([
    prisma.kbFaq.upsert({ where: { key }, create: { key, ...data }, update: data }),
    auditEntry(actorId, 'kb.faq_updated', 'kb_faq', key, { status: input.status }),
    ...(extra ? [auditEntry(actorId, extra, 'kb_faq', key)] : []),
  ]);
  revalidateHelp();
  return NextResponse.json({ key }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const access = await requireSupportAdmin(request, { mutation: true });
  if ('response' in access) return access.response;
  const { key } = await params;
  const current = await find(key);
  if (!current) return NextResponse.json({ error: 'Question introuvable.', code: 'NOT_FOUND' }, { status: 404 });
  const parsed = statusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Demande invalide.', code: 'INVALID_REQUEST' }, { status: 400 });
  const from = currentStatus(current);
  if (from === parsed.data.status) return NextResponse.json({ key, unchanged: true });
  const actorId = access.context.userId;
  const base = { key, question: current.question, answer: current.answer, category: current.category, articleSlug: current.article || null, links: (current.links ?? []) as unknown as Prisma.InputJsonValue, keywords: current.keywords ?? [] };
  const extra = statusAudit(from, parsed.data.status);
  await prisma.$transaction([
    prisma.kbFaq.upsert({ where: { key }, create: { ...base, status: parsed.data.status, updatedById: actorId }, update: { status: parsed.data.status, updatedById: actorId } }),
    ...(extra ? [auditEntry(actorId, extra, 'kb_faq', key)] : [auditEntry(actorId, 'kb.faq_updated', 'kb_faq', key, { to: parsed.data.status })]),
  ]);
  revalidateHelp();
  return NextResponse.json({ key, status: parsed.data.status }, { headers: { 'Cache-Control': 'no-store' } });
}

// A new question is deleted; for a built-in question, deleting restores the original (the override is removed).
export async function DELETE(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const access = await requireSupportAdmin(request, { mutation: true });
  if ('response' in access) return access.response;
  const { key } = await params;
  const current = await find(key);
  if (!current) return NextResponse.json({ error: 'Question introuvable.', code: 'NOT_FOUND' }, { status: 404 });
  if (current.origin === 'builtin' && !current.overridden) return NextResponse.json({ error: 'Une question intégrée ne peut pas être supprimée : masquez-la plutôt.', code: 'BUILTIN' }, { status: 400 });
  const actorId = access.context.userId;
  await prisma.$transaction([
    prisma.kbFaq.delete({ where: { key } }),
    auditEntry(actorId, current.origin === 'builtin' ? 'kb.faq_restored' : 'kb.faq_deleted', 'kb_faq', key),
  ]);
  revalidateHelp();
  return NextResponse.json({ deleted: true, restored: current.origin === 'builtin' }, { headers: { 'Cache-Control': 'no-store' } });
}
