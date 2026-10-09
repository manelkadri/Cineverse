import 'server-only';
import { cache } from 'react';
import { prisma } from './prisma';
import { HELP_ARTICLES, HELP_FAQ } from './help-content';
import { publicArticles, publicFaqs, type KbArticleRow, type KbFaqRow } from './kb-merge';

/** Every knowledge-base row plus the saved FAQ order. Throws if the tables are unavailable (callers decide what to do). */
export async function loadKnowledgeBaseRows() {
  const [articles, faqs, orderSetting] = await Promise.all([
    prisma.kbArticle.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.kbFaq.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.supportSetting.findUnique({ where: { key: 'faq-order' }, select: { value: true } }),
  ]);
  const order = Array.isArray(orderSetting?.value) ? (orderSetting.value as unknown[]).filter((key): key is string => typeof key === 'string') : [];
  return { articles: articles as unknown as KbArticleRow[], faqs: faqs as unknown as KbFaqRow[], order };
}

/**
 * What the PUBLIC Help Center shows: published content only (built-in content, its published overrides, and published new
 * entries). If the knowledge-base tables cannot be read (migration not applied, database error), the built-in content is
 * returned unchanged, so the Help Center stays complete and searchable. Cached for the duration of one request.
 */
export const loadPublishedKnowledgeBase = cache(async () => {
  try {
    const { articles, faqs, order } = await loadKnowledgeBaseRows();
    return { articles: publicArticles(HELP_ARTICLES, articles), faqs: publicFaqs(HELP_FAQ, faqs, order) };
  } catch {
    return { articles: HELP_ARTICLES, faqs: HELP_FAQ };
  }
});

/** A URL-safe slug from a title: accents removed, lower case, words joined with hyphens. */
export function slugify(title: string, max = 80) {
  return title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max).replace(/-+$/g, '');
}
