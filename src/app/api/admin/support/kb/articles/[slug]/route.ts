import { NextResponse } from 'next/server';
import { revalidateHelp } from '@/lib/help-revalidate';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSupportAdmin } from '@/lib/support-admin';
import { auditEntry } from '@/lib/support-server';
import { loadKnowledgeBaseRows } from '@/lib/kb-server';
import { adminArticles, type AdminArticle } from '@/lib/kb-merge';
import { HELP_ARTICLES } from '@/lib/help-content';
import { blocksProblem, blocksToText, parseArticleText } from '@/lib/kb-text';
import { kbArticleSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const statusSchema = z.object({ status: z.enum(['draft', 'published', 'archived']) }).strict();

async function find(slug: string): Promise<AdminArticle | undefined> {
  let rows: Awaited<ReturnType<typeof loadKnowledgeBaseRows>>['articles'] = [];
  try { rows = (await loadKnowledgeBaseRows()).articles; } catch { /* only built-in content is available */ }
  return adminArticles(HELP_ARTICLES, rows).find((article) => article.slug === slug);
}

const statusAudit = (from: string, to: string) => (to === 'published' ? 'kb.article_published' as const : from === 'published' ? 'kb.article_unpublished' as const : null);

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const access = await requireSupportAdmin(request);
  if ('response' in access) return access.response;
  const article = await find((await params).slug);
  if (!article) return NextResponse.json({ error: 'Article introuvable.', code: 'NOT_FOUND' }, { status: 404 });
  const { body, ...rest } = article;
  return NextResponse.json({ article: { ...rest, content: blocksToText(body) } }, { headers: { 'Cache-Control': 'no-store' } });
}

// Saves an article. For a built-in article the first save stores an override that replaces it once published; until then
// ("draft") visitors keep seeing the built-in text.
export async function PUT(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const access = await requireSupportAdmin(request, { mutation: true });
  if ('response' in access) return access.response;
  const { slug } = await params;
  const current = await find(slug);
  if (!current) return NextResponse.json({ error: 'Article introuvable.', code: 'NOT_FOUND' }, { status: 404 });
  const parsed = kbArticleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Demande invalide.', code: 'INVALID_REQUEST', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  const input = parsed.data;
  if (input.slug && input.slug !== slug) return NextResponse.json({ error: 'L’adresse d’un article ne peut pas être modifiée.', code: 'SLUG_LOCKED' }, { status: 400 });
  const blocks = parseArticleText(input.content);
  const problem = blocksProblem(blocks);
  if (problem) return NextResponse.json({ error: problem, code: 'INVALID_CONTENT', fields: { content: [problem] } }, { status: 400 });
  const actorId = access.context.userId;
  const from = current.overridden || current.origin === 'custom' ? (current.state === 'hidden' ? 'archived' : current.state) : 'published';
  const publishedNow = input.status === 'published' && from !== 'published';
  const data = { title: input.title, category: input.category, summary: input.summary, body: blocks as unknown as Prisma.InputJsonValue, links: input.links as unknown as Prisma.InputJsonValue, keywords: input.keywords, status: input.status, updatedById: actorId, ...(publishedNow ? { publishedAt: new Date() } : {}) };
  const extra = statusAudit(from, input.status);
  await prisma.$transaction([
    prisma.kbArticle.upsert({ where: { slug }, create: { slug, ...data, publishedAt: input.status === 'published' ? new Date() : null }, update: data }),
    auditEntry(actorId, 'kb.article_updated', 'kb_article', slug, { status: input.status }),
    ...(extra ? [auditEntry(actorId, extra, 'kb_article', slug)] : []),
  ]);
  revalidateHelp();
  return NextResponse.json({ slug }, { headers: { 'Cache-Control': 'no-store' } });
}

// Publish, unpublish or hide without editing the text. A built-in article gets an override row (copy of the built-in text).
export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const access = await requireSupportAdmin(request, { mutation: true });
  if ('response' in access) return access.response;
  const { slug } = await params;
  const current = await find(slug);
  if (!current) return NextResponse.json({ error: 'Article introuvable.', code: 'NOT_FOUND' }, { status: 404 });
  const parsed = statusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Demande invalide.', code: 'INVALID_REQUEST' }, { status: 400 });
  const actorId = access.context.userId;
  const from = current.overridden || current.origin === 'custom' ? (current.state === 'hidden' ? 'archived' : current.state) : 'published';
  if (from === parsed.data.status) return NextResponse.json({ slug, unchanged: true });
  const base = { slug, title: current.title, category: current.category, summary: current.summary, body: current.body as unknown as Prisma.InputJsonValue, links: current.links as unknown as Prisma.InputJsonValue, keywords: current.keywords };
  const extra = statusAudit(from, parsed.data.status);
  await prisma.$transaction([
    prisma.kbArticle.upsert({ where: { slug }, create: { ...base, status: parsed.data.status, publishedAt: parsed.data.status === 'published' ? new Date() : null, updatedById: actorId }, update: { status: parsed.data.status, updatedById: actorId, ...(parsed.data.status === 'published' ? { publishedAt: new Date() } : {}) } }),
    ...(extra ? [auditEntry(actorId, extra, 'kb_article', slug, { to: parsed.data.status })] : [auditEntry(actorId, 'kb.article_updated', 'kb_article', slug, { to: parsed.data.status })]),
  ]);
  revalidateHelp();
  return NextResponse.json({ slug, status: parsed.data.status }, { headers: { 'Cache-Control': 'no-store' } });
}

// A new article is deleted. For a built-in article, deleting means "restore the original": the override is removed and the
// built-in text is live again. A built-in article with no override cannot be deleted (hide it instead).
export async function DELETE(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const access = await requireSupportAdmin(request, { mutation: true });
  if ('response' in access) return access.response;
  const { slug } = await params;
  const current = await find(slug);
  if (!current) return NextResponse.json({ error: 'Article introuvable.', code: 'NOT_FOUND' }, { status: 404 });
  if (current.origin === 'builtin' && !current.overridden) return NextResponse.json({ error: 'Un article intégré ne peut pas être supprimé : masquez-le plutôt.', code: 'BUILTIN' }, { status: 400 });
  const actorId = access.context.userId;
  await prisma.$transaction([
    prisma.kbArticle.delete({ where: { slug } }),
    auditEntry(actorId, current.origin === 'builtin' ? 'kb.article_restored' : 'kb.article_deleted', 'kb_article', slug),
  ]);
  revalidateHelp();
  return NextResponse.json({ deleted: true, restored: current.origin === 'builtin' }, { headers: { 'Cache-Control': 'no-store' } });
}
