import { NextResponse } from 'next/server';
import { revalidateHelp } from '@/lib/help-revalidate';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSupportAdmin } from '@/lib/support-admin';
import { auditEntry } from '@/lib/support-server';
import { loadKnowledgeBaseRows, slugify } from '@/lib/kb-server';
import { adminArticles } from '@/lib/kb-merge';
import { HELP_ARTICLES } from '@/lib/help-content';
import { blocksProblem, parseArticleText } from '@/lib/kb-text';
import { kbArticleSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Support staff only. Every article, built-in or new, with its origin and state ("published", "draft", "hidden").
export async function GET(request: Request) {
  const access = await requireSupportAdmin(request);
  if ('response' in access) return access.response;
  try {
    const { articles } = await loadKnowledgeBaseRows();
    return NextResponse.json({ articles: adminArticles(HELP_ARTICLES, articles).map(({ body, links, ...article }) => { void body; void links; return article; }) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    // the knowledge-base tables are not available: the built-in articles are still listed, read-only
    return NextResponse.json({ articles: adminArticles(HELP_ARTICLES, []).map(({ body, links, ...article }) => { void body; void links; return article; }), unavailable: true }, { headers: { 'Cache-Control': 'no-store' } });
  }
}

// Creates a NEW article (to change a built-in one, use PUT on its address, which stores an override). A slug that belongs to a
// built-in article is refused so a new article can never silently replace one.
export async function POST(request: Request) {
  const access = await requireSupportAdmin(request, { mutation: true });
  if ('response' in access) return access.response;
  const parsed = kbArticleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Demande invalide.', code: 'INVALID_REQUEST', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  const input = parsed.data;
  const blocks = parseArticleText(input.content);
  const problem = blocksProblem(blocks);
  if (problem) return NextResponse.json({ error: problem, code: 'INVALID_CONTENT', fields: { content: [problem] } }, { status: 400 });
  const slug = input.slug ?? slugify(input.title);
  if (slug.length < 3) return NextResponse.json({ error: 'Adresse invalide : donnez un titre plus explicite.', code: 'INVALID_REQUEST' }, { status: 400 });
  if (HELP_ARTICLES.some((article) => article.slug === slug)) return NextResponse.json({ error: 'Cette adresse appartient à un article intégré : modifiez cet article plutôt que d’en créer un nouveau.', code: 'SLUG_RESERVED' }, { status: 409 });
  if (await prisma.kbArticle.findUnique({ where: { slug }, select: { id: true } })) return NextResponse.json({ error: 'Cette adresse est déjà utilisée.', code: 'DUPLICATE' }, { status: 409 });
  const actorId = access.context.userId;
  const publish = input.status === 'published';
  await prisma.$transaction([
    prisma.kbArticle.create({ data: { slug, title: input.title, category: input.category, summary: input.summary, body: blocks as unknown as Prisma.InputJsonValue, links: input.links as unknown as Prisma.InputJsonValue, keywords: input.keywords, status: input.status, publishedAt: publish ? new Date() : null, updatedById: actorId } }),
    auditEntry(actorId, 'kb.article_created', 'kb_article', slug, { status: input.status }),
    ...(publish ? [auditEntry(actorId, 'kb.article_published', 'kb_article', slug)] : []),
  ]);
  revalidateHelp();
  return NextResponse.json({ slug }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
