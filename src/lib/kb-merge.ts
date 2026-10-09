import type { CategoryId, HelpArticle, HelpBlock, HelpFaq, HelpLink } from './help-content';

// How the Help Center combines its built-in content with knowledge-base edits.
//   - A database row with the slug (or key) of a built-in entry OVERRIDES it:
//       published -> the edited version is live
//       draft     -> edits not live yet; the built-in version stays live
//       archived  -> the entry is hidden ("masqué")
//   - A row that matches no built-in entry is a new entry: live only when published.
//   - With no rows at all the result is exactly the built-in content, so the public Help Center keeps working whatever
//     happens to the database.

export type KbStatus = 'draft' | 'published' | 'archived';
export type KbState = 'published' | 'draft' | 'hidden';

export interface KbArticleRow { slug: string; title: string; category: string; summary: string; body: unknown; links: unknown; keywords: string[]; status: string; publishedAt?: Date | string | null; updatedAt?: Date | string }
export interface KbFaqRow { key: string; question: string; answer: string; category: string; articleSlug: string | null; links: unknown; keywords: string[]; status: string; createdAt?: Date | string; updatedAt?: Date | string }

export interface AdminArticle extends HelpArticle { origin: 'builtin' | 'custom'; state: KbState; overridden: boolean; live: boolean; updatedAt: string | null }
export interface AdminFaq extends HelpFaq { key: string; origin: 'builtin' | 'custom'; state: KbState; overridden: boolean; live: boolean; updatedAt: string | null }

const asBlocks = (value: unknown): HelpBlock[] => (Array.isArray(value) ? (value as HelpBlock[]) : []);
const asLinks = (value: unknown): HelpLink[] => (Array.isArray(value) ? (value as HelpLink[]) : []);
const iso = (value?: Date | string | null) => (value ? new Date(value).toISOString() : null);
const stateOf = (status: string): KbState => (status === 'published' ? 'published' : status === 'archived' ? 'hidden' : 'draft');

export const articleFromRow = (row: KbArticleRow): HelpArticle => ({ slug: row.slug, title: row.title, category: row.category as CategoryId, summary: row.summary, body: asBlocks(row.body), links: asLinks(row.links), keywords: row.keywords });
export const faqFromRow = (row: KbFaqRow): HelpFaq => ({ id: row.key, question: row.question, answer: row.answer, category: row.category as CategoryId, article: row.articleSlug ?? '', links: asLinks(row.links), keywords: row.keywords });

/** Every article as the administrator sees it, with its origin and state; `live` says whether visitors see it. */
export function adminArticles(builtin: HelpArticle[], rows: KbArticleRow[]): AdminArticle[] {
  const bySlug = new Map(rows.map((row) => [row.slug, row]));
  const result: AdminArticle[] = builtin.map((article) => {
    const row = bySlug.get(article.slug);
    if (!row) return { ...article, origin: 'builtin', state: 'published', overridden: false, live: true, updatedAt: null };
    const state = stateOf(row.status);
    // a draft override is a work in progress: the built-in version is still what visitors see
    return { ...articleFromRow(row), origin: 'builtin', state, overridden: true, live: state !== 'hidden', updatedAt: iso(row.updatedAt) };
  });
  for (const row of rows) {
    if (builtin.some((article) => article.slug === row.slug)) continue;
    const state = stateOf(row.status);
    result.push({ ...articleFromRow(row), origin: 'custom', state, overridden: false, live: state === 'published', updatedAt: iso(row.updatedAt) });
  }
  return result;
}

/** What the public Help Center shows: built-in articles (or their published override), plus published new ones. */
export function publicArticles(builtin: HelpArticle[], rows: KbArticleRow[]): HelpArticle[] {
  const bySlug = new Map(rows.map((row) => [row.slug, row]));
  const live: HelpArticle[] = [];
  for (const article of builtin) {
    const row = bySlug.get(article.slug);
    if (!row || row.status === 'draft') live.push(article);
    else if (row.status === 'published') live.push(articleFromRow(row));
    // archived: hidden
  }
  for (const row of rows) if (row.status === 'published' && !builtin.some((article) => article.slug === row.slug)) live.push(articleFromRow(row));
  return live;
}

/**
 * FAQ order: the saved order (a list of keys, kept in the support settings) first, then every entry it does not mention
 * in its natural order (built-in questions, then new ones by creation date). With no saved order this is the natural order.
 */
function ordered<T extends { key: string }>(items: T[], order: string[]): T[] {
  const rank = new Map(order.map((key, index) => [key, index]));
  return items.map((item, index) => ({ item, at: rank.has(item.key) ? (rank.get(item.key) as number) : order.length + index })).sort((x, y) => x.at - y.at).map((entry) => entry.item);
}

export function adminFaqs(builtin: HelpFaq[], rows: KbFaqRow[], order: string[] = []): AdminFaq[] {
  const byKey = new Map(rows.map((row) => [row.key, row]));
  const items: AdminFaq[] = builtin.map((faq) => {
    const row = byKey.get(faq.id);
    if (!row) return { ...faq, key: faq.id, origin: 'builtin', state: 'published', overridden: false, live: true, updatedAt: null };
    const state = stateOf(row.status);
    return { ...faqFromRow(row), key: row.key, origin: 'builtin', state, overridden: true, live: state !== 'hidden', updatedAt: iso(row.updatedAt) };
  });
  const custom = rows.filter((row) => !builtin.some((faq) => faq.id === row.key)).sort((x, y) => new Date(x.createdAt ?? 0).getTime() - new Date(y.createdAt ?? 0).getTime());
  for (const row of custom) {
    const state = stateOf(row.status);
    items.push({ ...faqFromRow(row), key: row.key, origin: 'custom', state, overridden: false, live: state === 'published', updatedAt: iso(row.updatedAt) });
  }
  return ordered(items, order);
}

export function publicFaqs(builtin: HelpFaq[], rows: KbFaqRow[], order: string[] = []): HelpFaq[] {
  return adminFaqs(builtin, rows, order).filter((faq) => faq.live).map((faq): HelpFaq => {
    // a draft override of a built-in question is not live yet: visitors keep the built-in text
    if (faq.origin === 'builtin' && faq.state === 'draft') return builtin.find((item) => item.id === faq.id) as HelpFaq;
    const { origin, state, overridden, live, updatedAt, key, ...plain } = faq;
    void origin; void state; void overridden; void live; void updatedAt; void key;
    return plain;
  });
}
