import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { HELP_ARTICLES, HELP_CATEGORIES, HELP_FAQ, articleBySlug, articlesInCategory, type HelpBlock } from '../src/lib/help-content';
import { normalize, searchArticles, searchFaq } from '../src/lib/help-search';

const blockText = (block: HelpBlock) => ('items' in block ? block.items.join(' ') : block.text);
const articleText = (slug: string) => { const article = articleBySlug(slug)!; return `${article.title} ${article.summary} ${article.body.map(blockText).join(' ')}`; };
const allText = [...HELP_ARTICLES.map((article) => articleText(article.slug)), ...HELP_FAQ.map((faq) => `${faq.question} ${faq.answer}`)].join('\n');

describe('help content structure', () => {
  it('has the six required categories, each with several articles', () => {
    assert.deepEqual(HELP_CATEGORIES.map((category) => category.id), ['compte', 'profils', 'films', 'liste', 'securite', 'technique']);
    for (const category of HELP_CATEGORIES) assert.ok(articlesInCategory(category.id).length >= 4, `${category.id} has articles`);
  });

  it('gives every article a unique kebab-case slug, a valid category, a summary, a body and keywords', () => {
    const slugs = HELP_ARTICLES.map((article) => article.slug);
    assert.equal(new Set(slugs).size, slugs.length, 'slugs are unique');
    for (const article of HELP_ARTICLES) {
      assert.match(article.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/);
      assert.ok(HELP_CATEGORIES.some((category) => category.id === article.category), `${article.slug} category`);
      assert.ok(article.title.length > 5 && article.summary.length > 10 && article.body.length > 0 && article.keywords.length > 0, article.slug);
    }
  });

  it('links every FAQ entry to an existing article of the same category, with unique ids', () => {
    assert.equal(new Set(HELP_FAQ.map((faq) => faq.id)).size, HELP_FAQ.length);
    for (const faq of HELP_FAQ) {
      const article = articleBySlug(faq.article);
      assert.ok(article, `${faq.id} points to ${faq.article}`);
      assert.equal(article.category, faq.category, `${faq.id} category matches its article`);
    }
  });

  it('only links to pages that exist', () => {
    const staticRoutes = new Set(['/', '/login', '/profiles', '/account', '/my-list', '/films-series-catalog', '/help', '/help#faq', '/help#contact']);
    const routeExists = (route: string) => route === '/' ? existsSync(join(__dirname, '../src/app/page.tsx')) : existsSync(join(__dirname, '../src/app', route.slice(1), 'page.tsx'));
    const hrefs = [...HELP_ARTICLES.flatMap((article) => article.links), ...HELP_FAQ.flatMap((faq) => faq.links ?? [])].map((link) => link.href);
    assert.ok(hrefs.length > 20);
    for (const href of hrefs) {
      if (href.startsWith('/help/')) assert.ok(articleBySlug(href.slice('/help/'.length)), `${href} is an article`);
      else {
        assert.ok(staticRoutes.has(href), `${href} is a known route`);
        assert.ok(routeExists(href.split('#')[0]), `${href} has a page`);
      }
    }
  });
});

describe('help content stays truthful', () => {
  it('says that full-length streaming is not available', () => {
    const text = normalize(articleText('disponibilite-des-contenus'));
    assert.ok(text.includes('aucune source de streaming autorisee'));
    assert.ok(normalize(HELP_FAQ.find((faq) => faq.id === 'faq-streaming')!.answer).startsWith('non'));
  });

  it('does not promise a password reset by e-mail or an e-mail change', () => {
    const forgotten = normalize(articleText('mot-de-passe-oublie'));
    assert.ok(forgotten.includes('ne propose pas encore'));
    assert.ok(normalize(articleText('gerer-les-informations-du-compte')).includes('ne peut pas etre modifiee'));
    assert.equal(/(cliquez|appuyez) sur[^.]*(mot de passe oublié|réinitialiser)/i.test(allText), false, 'no invented recovery button');
  });

  it('never asks for passwords or PINs in a support message', () => {
    assert.ok(normalize(articleText('signaler-un-probleme')).includes('jamais votre mot de passe'));
    assert.equal(/(?<!n’)envoyez[^.]*(mot de passe|code PIN)/i.test(allText), false, 'no instruction to send a secret');
  });

  it('describes PIN recovery as an owner check with the account password', () => {
    const recovery = normalize(articleText('code-pin-oublie'));
    assert.ok(recovery.includes('mot de passe de votre compte'));
    assert.ok(recovery.includes('sans perdre'));
  });
});

describe('help search', () => {
  it('ignores case, accents and punctuation', () => {
    assert.equal(normalize('  Mot de passe OUBLIÉ ? '), 'mot de passe oublie');
    assert.equal(normalize('J’ai oublié le code PIN d’un profil'), 'j ai oublie le code pin d un profil');
    assert.equal(normalize('Cœur'), 'coeur');
  });

  it('finds answers with or without accents', () => {
    for (const query of ['mot de passe oublié', 'MOT DE PASSE OUBLIE', 'oublie', 'Oublié']) {
      assert.ok(searchFaq(query).some((faq) => faq.id === 'faq-mdp-oublie'), `faq for "${query}"`);
      assert.ok(searchArticles(query).some((article) => article.slug === 'mot-de-passe-oublie'), `article for "${query}"`);
    }
    assert.equal(searchArticles('bande annonce')[0].slug.includes('bande-annonce') || searchArticles('bande annonce').some((a) => a.slug === 'regarder-une-bande-annonce'), true);
    assert.ok(searchArticles('verrouille tentatives').some((article) => article.slug === 'blocage-temporaire-du-code-pin'));
  });

  it('searches the article content, not only titles', () => {
    assert.ok(searchArticles('SUPPRIMER').some((article) => article.slug === 'supprimer-son-compte'));
    assert.ok(searchArticles('15 minutes').some((article) => article.slug === 'blocage-temporaire-du-code-pin'));
  });

  it('requires every word to match and returns nothing for gibberish', () => {
    assert.deepEqual(searchArticles('zzzzqqqq'), []);
    assert.deepEqual(searchFaq('zzzzqqqq'), []);
    const narrow = searchArticles('pin oublie').length;
    assert.ok(narrow > 0 && narrow < searchArticles('pin').length + 1);
    assert.deepEqual(searchArticles('pin zzzzqqqq'), []);
  });

  it('ranks title matches first', () => {
    assert.equal(searchArticles('changer un code pin')[0].slug, 'changer-un-code-pin');
    assert.equal(searchArticles('navigateurs')[0].slug, 'navigateurs-compatibles');
  });

  it('filters by category, with or without a query', () => {
    const profils = searchArticles('', 'profils');
    assert.ok(profils.length >= 8 && profils.every((article) => article.category === 'profils'));
    assert.ok(searchArticles('liste', 'liste').every((article) => article.category === 'liste'));
    assert.deepEqual(searchArticles('supprimer', 'films'), [], 'no match in an unrelated category');
    assert.ok(searchFaq('', 'technique').every((faq) => faq.category === 'technique'));
  });

  it('returns everything for an empty query', () => {
    assert.equal(searchArticles('').length, HELP_ARTICLES.length);
    assert.equal(searchFaq('   ').length, HELP_FAQ.length);
  });
});
