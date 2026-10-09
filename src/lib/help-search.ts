import { HELP_ARTICLES, HELP_FAQ, type CategoryId, type HelpArticle, type HelpBlock, type HelpFaq } from './help-content';

/** Lower-case and strip accents/ligatures/punctuation so "Mot de passe oublié" matches "OUBLIE" and "oublie ?". */
export function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/gi, 'oe')
    .replace(/æ/gi, 'ae')
    .replace(/[’']/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const blockText = (block: HelpBlock) => ('items' in block ? block.items.join(' ') : block.text);

interface Entry<T> { item: T; title: string; keywords: string; body: string }

const articleEntries: Entry<HelpArticle>[] = HELP_ARTICLES.map((article) => ({
  item: article,
  title: normalize(article.title),
  keywords: normalize(article.keywords.join(' ')),
  body: normalize(`${article.summary} ${article.body.map(blockText).join(' ')} ${article.links.map((link) => link.label).join(' ')}`),
}));

const faqEntries: Entry<HelpFaq>[] = HELP_FAQ.map((faq) => ({
  item: faq,
  title: normalize(faq.question),
  keywords: normalize((faq.keywords ?? []).join(' ')),
  body: normalize(faq.answer),
}));

/** Every word of the query must appear somewhere (AND); a title hit counts most, then keywords, then the content. */
function score(entry: Entry<unknown>, tokens: string[]) {
  let total = 0;
  for (const token of tokens) {
    const inTitle = entry.title.includes(token);
    const inKeywords = entry.keywords.includes(token);
    const inBody = entry.body.includes(token);
    if (!inTitle && !inKeywords && !inBody) return 0;
    total += (inTitle ? 6 : 0) + (inKeywords ? 4 : 0) + (inBody ? 1 : 0);
  }
  return total;
}

function run<T>(entries: Entry<T>[], query: string, category?: CategoryId | null, categoryOf?: (item: T) => CategoryId): T[] {
  const tokens = normalize(query).split(' ').filter(Boolean);
  const inScope = entries.filter((entry) => !category || !categoryOf || categoryOf(entry.item) === category);
  if (tokens.length === 0) return inScope.map((entry) => entry.item);
  return inScope
    .map((entry, index) => ({ entry, index, points: score(entry, tokens) }))
    .filter((hit) => hit.points > 0)
    .sort((a, b) => b.points - a.points || a.index - b.index)
    .map((hit) => hit.entry.item);
}

export const searchArticles = (query: string, category?: CategoryId | null) => run(articleEntries, query, category, (article) => article.category);
export const searchFaq = (query: string, category?: CategoryId | null) => run(faqEntries, query, category, (faq) => faq.category);
