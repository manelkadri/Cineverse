import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HELP_ARTICLES, HELP_FAQ } from '../src/lib/help-content';
import { adminArticles, adminFaqs, publicArticles, publicFaqs } from '../src/lib/kb-merge';
import { blocksProblem, blocksToText, linksProblem, parseArticleText } from '../src/lib/kb-text';
import { adminHighPriority, adminAssigned, adminReopened, adminTicketNew, adminUserReply, ticketReply } from '../src/lib/notification-events';
import { AUDIT_ACTIONS, AUDIT_LABELS, isHighPriority, mergeCategories, priorityId, priorityLevel } from '../src/lib/support-meta';
import { SUPPORT_CATEGORIES } from '../src/lib/support-rules';
import { adminAnalyticsQuerySchema, kbArticleSchema, kbFaqOrderSchema, kbFaqSchema, supportAvailabilitySchema, supportCategoryCreateSchema, supportCategoryPatchSchema, userSupportMessageSchema } from '../src/lib/validation';

const article = { title: 'Un titre assez long', category: 'compte', summary: 'Un résumé suffisamment long.', content: '## Titre\nBonjour' };
const row = (slug: string, status: string, extra: object = {}) => ({ slug, title: 'Titre modifié', category: 'compte', summary: 'Résumé modifié.', body: [{ type: 'p', text: 'Texte' }], links: [], keywords: [], status, ...extra });
const faqRow = (key: string, status: string, extra: object = {}) => ({ key, question: 'Question ?', answer: 'Réponse suffisante.', category: 'compte', articleSlug: null, links: [], keywords: [], status, createdAt: new Date(2026, 0, 1), ...extra });

describe('knowledge-base text format', () => {
  it('turns plain text into typed blocks and back', () => {
    const blocks = parseArticleText('## Section\nUn paragraphe\n\n1. Un\n2. Deux\n\n- a\n- b\n\n> Note : info\n> Attention : danger');
    assert.deepEqual(blocks.map((block) => block.type), ['h', 'p', 'steps', 'list', 'note', 'warning']);
    assert.deepEqual(parseArticleText(blocksToText(blocks)), blocks, 'round trip');
  });

  it('never produces markup: HTML stays a literal string for React to escape', () => {
    const blocks = parseArticleText('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>');
    assert.ok(blocks.every((block) => block.type === 'p'));
    assert.equal((blocks[0] as { text: string }).text, '<script>alert(1)</script>');
  });

  it('rejects empty, oversized and over-long content', () => {
    assert.match(blocksProblem([]) ?? '', /vide/);
    assert.match(blocksProblem(parseArticleText('x'.repeat(1600))) ?? '', /trop long/);
    assert.match(blocksProblem(parseArticleText(Array.from({ length: 70 }, (_, i) => `## ${i}`).join('\n\n'))) ?? '', /trop long/);
    assert.equal(blocksProblem(parseArticleText('Bonjour')), null);
  });

  it('only accepts internal links', () => {
    assert.equal(linksProblem([{ label: 'Compte', href: '/account' }]), null);
    for (const href of ['https://evil.example', '//evil.example', 'javascript:alert(1)', '/\\evil']) assert.ok(linksProblem([{ label: 'x', href }]), href);
    assert.ok(linksProblem(Array.from({ length: 9 }, () => ({ label: 'x', href: '/help' }))));
  });
});

describe('knowledge-base merge (built-in content is preserved)', () => {
  const builtinSlug = HELP_ARTICLES[0].slug;

  it('with no database rows, the public content is exactly the built-in content', () => {
    assert.deepEqual(publicArticles(HELP_ARTICLES, []), HELP_ARTICLES);
    assert.deepEqual(publicFaqs(HELP_FAQ, []), HELP_FAQ);
    assert.equal(adminArticles(HELP_ARTICLES, []).length, HELP_ARTICLES.length);
  });

  it('a draft override keeps the built-in text live; a published one replaces it; an archived one hides it', () => {
    assert.equal(publicArticles(HELP_ARTICLES, [row(builtinSlug, 'draft')]).find((a) => a.slug === builtinSlug)?.title, HELP_ARTICLES[0].title);
    assert.equal(publicArticles(HELP_ARTICLES, [row(builtinSlug, 'published')]).find((a) => a.slug === builtinSlug)?.title, 'Titre modifié');
    assert.equal(publicArticles(HELP_ARTICLES, [row(builtinSlug, 'archived')]).some((a) => a.slug === builtinSlug), false);
    assert.equal(publicArticles(HELP_ARTICLES, [row(builtinSlug, 'archived')]).length, HELP_ARTICLES.length - 1);
  });

  it('new articles appear publicly only when published', () => {
    assert.equal(publicArticles(HELP_ARTICLES, [row('nouvel-article', 'draft')]).length, HELP_ARTICLES.length);
    assert.equal(publicArticles(HELP_ARTICLES, [row('nouvel-article', 'published')]).length, HELP_ARTICLES.length + 1);
    const listed = adminArticles(HELP_ARTICLES, [row('nouvel-article', 'draft')]).find((a) => a.slug === 'nouvel-article');
    assert.deepEqual([listed?.origin, listed?.state, listed?.live], ['custom', 'draft', false]);
  });

  it('FAQ: override, hide, new entries and the saved order', () => {
    const first = HELP_FAQ[0].id;
    const second = HELP_FAQ[1].id;
    assert.equal(publicFaqs(HELP_FAQ, [faqRow(first, 'archived')]).some((f) => f.id === first), false);
    assert.equal(publicFaqs(HELP_FAQ, [faqRow('custom-aaa', 'draft')]).length, HELP_FAQ.length);
    assert.equal(publicFaqs(HELP_FAQ, [faqRow('custom-aaa', 'published')]).length, HELP_FAQ.length + 1);
    const order = adminFaqs(HELP_FAQ, [], [second, first]).map((f) => f.key);
    assert.deepEqual(order.slice(0, 2), [second, first]);
    assert.equal(order.length, HELP_FAQ.length, 'an order never drops or repeats an entry');
    assert.equal(adminFaqs(HELP_FAQ, [], ['unknown-key']).length, HELP_FAQ.length, 'unknown keys in the saved order are ignored');
  });

  it('keeps at least the 34 articles and 17 questions the Help Center shipped with', () => {
    assert.ok(HELP_ARTICLES.length >= 34);
    assert.ok(HELP_FAQ.length >= 17);
  });
});

describe('contact categories', () => {
  it('with no rows, exactly the built-in list', () => {
    assert.deepEqual(mergeCategories([]).map((c) => c.id), SUPPORT_CATEGORIES.map((c) => c.id));
  });
  it('renames, disables, reorders and extends', () => {
    const merged = mergeCategories([{ id: 'login', label: 'Connexion !', enabled: false, position: 999 }, { id: 'billing', label: 'Facturation', enabled: true, position: 5 }]);
    assert.equal(merged[0].id, 'billing');
    assert.equal(merged[merged.length - 1].id, 'login');
    const login = merged.find((c) => c.id === 'login');
    assert.deepEqual([login?.label, login?.enabled, login?.builtin], ['Connexion !', false, true]);
    assert.equal(merged.find((c) => c.id === 'billing')?.builtin, false);
  });
});

describe('priorities and audit labels', () => {
  it('maps levels both ways and flags high priority', () => {
    for (const id of ['low', 'normal', 'high', 'urgent'] as const) assert.equal(priorityId(priorityLevel(id)), id);
    assert.equal(priorityId(42), 'normal');
    assert.deepEqual([0, 1, 2, 3].map(isHighPriority), [false, false, true, true]);
  });
  it('every audit action has a French label', () => {
    for (const action of AUDIT_ACTIONS) assert.ok(AUDIT_LABELS[action], action);
  });
});

describe('new request schemas', () => {
  it('knowledge-base article: strict, with a bounded status', () => {
    assert.ok(kbArticleSchema.safeParse(article).success);
    assert.equal(kbArticleSchema.safeParse({ ...article, status: 'weird' }).success, false);
    assert.equal(kbArticleSchema.safeParse({ ...article, category: 'nope' }).success, false);
    assert.equal(kbArticleSchema.safeParse({ ...article, isSupportAdmin: true }).success, false, 'unknown keys are refused');
    assert.equal(kbArticleSchema.safeParse({ ...article, links: [{ label: 'x', href: 'https://evil.example' }] }).success, false);
  });
  it('FAQ and FAQ order', () => {
    assert.ok(kbFaqSchema.safeParse({ question: 'Une question ?', answer: 'Une réponse assez longue.', category: 'compte' }).success);
    assert.equal(kbFaqSchema.safeParse({ question: 'Q', answer: 'R', category: 'compte' }).success, false);
    assert.ok(kbFaqOrderSchema.safeParse({ keys: ['a1', 'b2'] }).success);
    assert.equal(kbFaqOrderSchema.safeParse({ keys: [] }).success, false);
  });
  it('categories, availability and analytics ranges', () => {
    assert.ok(supportCategoryCreateSchema.safeParse({ id: 'facturation', label: 'Facturation' }).success);
    assert.equal(supportCategoryCreateSchema.safeParse({ id: 'Bad ID', label: 'x' }).success, false);
    assert.ok(supportCategoryPatchSchema.safeParse({ move: 'up' }).success);
    assert.equal(supportCategoryPatchSchema.safeParse({ move: 'sideways' }).success, false);
    assert.equal(supportAvailabilitySchema.safeParse({ enabled: true, text: '' }).success, false, 'enabling needs a text');
    assert.ok(supportAvailabilitySchema.safeParse({ enabled: false, text: '' }).success);
    assert.equal(adminAnalyticsQuerySchema.parse({}).granularity, 'day');
    assert.equal(adminAnalyticsQuerySchema.safeParse({ granularity: "day'; DROP TABLE" }).success, false);
  });
  it('a member message is bounded and carries nothing else', () => {
    assert.ok(userSupportMessageSchema.safeParse({ body: 'Bonjour' }).success);
    assert.equal(userSupportMessageSchema.safeParse({ body: '' }).success, false);
    assert.equal(userSupportMessageSchema.safeParse({ body: 'x'.repeat(2001) }).success, false);
    assert.equal(userSupportMessageSchema.safeParse({ body: 'ok', visibility: 'internal' }).success, false, 'a member cannot post a private note');
  });
});

describe('support notification events', () => {
  it('link to the right area and use stable de-duplication keys', () => {
    const id = 'ckabcdefgh12345678';
    assert.equal(adminTicketNew(id, 'Sujet').href, `/admin/support/tickets/${id}`);
    assert.equal(ticketReply(id, 'm1').href, `/account/support/${id}`);
    assert.equal(adminUserReply(id, 'm1').dedupeKey, adminUserReply(id, 'm1').dedupeKey);
    assert.notEqual(adminUserReply(id, 'm1').dedupeKey, adminUserReply(id, 'm2').dedupeKey);
    assert.notEqual(adminReopened(id, 1).dedupeKey, adminReopened(id, 2).dedupeKey, 'a second reopening notifies again');
    for (const draft of [adminTicketNew(id, 's'), adminUserReply(id, 'm'), adminHighPriority(id, 'Urgente', 1), adminAssigned(id, 'u', 1), adminReopened(id, 1)]) assert.match(draft.type, /^admin_/);
    assert.equal(ticketReply(id, 'm').type.startsWith('admin_'), false, 'member notifications never use the admin prefix');
  });
  it('never put the message text in a notification', () => {
    const draft = adminTicketNew('ckabcdefgh12345678', 'x'.repeat(200));
    assert.ok(draft.message.length < 120);
  });
});
