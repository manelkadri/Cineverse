/* global document, window, getComputedStyle, MutationObserver */
// Browser tests for the Help Center (real Chromium, real rendering).
//
//   npm i -D playwright && npx playwright install chromium     (not a project dependency)
//   E2E_BASE_URL=http://localhost:4101 node tests/browser/help-center.mjs
//
// Point it at a production server backed by an ISOLATED test database (one check registers a test account). The server must
// have been built WITHOUT NEXT_PUBLIC_SUPPORT_EMAIL, which is the default, to see the "no contact channel" state.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4101';
const PASSWORD = 'Browser-Test-Pass-9x';
const PIN = '7392';
const results = [];
const check = (name, fn) => results.push({ name, fn });

const anonymous = async (browser, options = {}) => {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message.slice(0, 160)));
  return { context, page, errors };
};
const openHelp = async (page, path = '/help') => {
  await page.goto(`${BASE}${path}`);
  await page.getByRole('heading', { level: 1 }).waitFor({ timeout: 20000 });
};
const search = (page) => page.locator('#help-search');
const titles = (page) => page.locator('[data-testid="article-list"] li a span:nth-child(2)').allTextContents();

check('the Help Center is public: it opens without logging in, with the required heading, subtitle and search', async () => {
  const { context, page, errors } = await anonymous(browser);
  const response = await page.goto(`${BASE}/help`);
  assert.equal(response.status(), 200);
  assert.match(page.url(), /\/help$/, 'no redirect to the login');
  await page.getByRole('heading', { name: 'Comment pouvons-nous vous aider ?', level: 1 }).waitFor();
  await page.getByText('Trouvez rapidement des réponses à vos questions sur CINEVERSE.').waitFor();
  assert.equal(await search(page).getAttribute('placeholder'), 'Rechercher une question ou un problème...');
  assert.equal(await page.locator('[data-category]').count(), 6, 'six categories');
  await page.getByRole('link', { name: 'Se connecter' }).waitFor();
  assert.equal(await page.locator('[data-cinematic-transition]').count(), 0, 'no cinematic loader');
  assert.match(await page.title(), /Centre d’aide/);
  assert.deepEqual(errors, []);
  await context.close();
});

check('article pages open directly, have their own title, breadcrumbs and a way back; unknown articles are a 404', async () => {
  const { context, page } = await anonymous(browser);
  const response = await page.goto(`${BASE}/help/code-pin-oublie`);
  assert.equal(response.status(), 200);
  await page.getByTestId('article-title').waitFor();
  assert.equal((await page.getByTestId('article-title').textContent()).trim(), 'J’ai oublié le code PIN d’un profil');
  assert.match(await page.title(), /^J’ai oublié le code PIN d’un profil — Centre d’aide CINEVERSE$/);
  await page.getByRole('navigation', { name: 'Fil d’Ariane' }).waitFor();
  await page.getByRole('link', { name: 'Retour au Centre d’aide' }).click();
  await page.waitForURL(/\/help$/);
  await page.goBack();
  await page.waitForURL(/\/help\/code-pin-oublie$/);
  await page.goForward();
  await page.waitForURL(/\/help$/);
  assert.equal((await page.goto(`${BASE}/help/cet-article-nexiste-pas`)).status(), 404);
  await context.close();
});

check('every article loads and every internal link in the help content points to a page that exists', async () => {
  const { context, page } = await anonymous(browser);
  await openHelp(page);
  const slugs = new Set();
  for (const id of ['compte', 'profils', 'films', 'liste', 'securite', 'technique']) {
    await page.locator(`[data-category="${id}"]`).click();
    for (const href of await page.locator('[data-testid="article-list"] a').evaluateAll((links) => links.map((link) => link.getAttribute('href')))) slugs.add(href);
    await page.locator(`[data-category="${id}"]`).click();
  }
  assert.ok(slugs.size >= 30, `${slugs.size} articles listed`);
  const targets = new Set();
  for (const href of slugs) {
    const res = await page.request.get(`${BASE}${href}`);
    assert.equal(res.status(), 200, href);
    const html = await res.text();
    assert.match(html, /Centre d’aide CINEVERSE<\/title>/, `${href} has a title`);
    for (const match of html.matchAll(/href="(\/[^"#]*)(?:#[^"]*)?"/g)) if (!match[1].startsWith('/_next') && !match[1].includes('.')) targets.add(match[1]);
  }
  for (const target of targets) {
    const res = await page.request.get(`${BASE}${target}`, { maxRedirects: 0 });
    assert.ok([200, 307].includes(res.status()), `${target} answered ${res.status()}`); // protected pages redirect to the login
  }
  await context.close();
});

check('search is case- and accent-insensitive, ranks results, has a clear button, Escape and an empty state', async () => {
  const { context, page } = await anonymous(browser);
  await openHelp(page);
  for (const query of ['mot de passe oublie', 'MOT DE PASSE OUBLIÉ']) {
    await search(page).fill(query);
    await page.getByRole('link', { name: /J’ai oublié mon mot de passe/ }).first().waitFor();
    assert.ok((await page.locator('[data-testid="faq-section"] [data-accordion-item]').allTextContents()).some((text) => /oublié mon mot de passe/i.test(text)), 'FAQ match too');
    assert.match(await page.locator('#help-results-status').textContent(), /\d+ articles? et \d+ questions? trouvé/);
  }
  await search(page).fill('changer un code pin');
  await page.locator('[data-testid="article-list"] li').first().waitFor();
  assert.equal((await titles(page))[0], 'Changer un code PIN en toute sécurité', 'best match first');
  await page.getByRole('button', { name: 'Effacer la recherche' }).click();
  assert.equal(await search(page).inputValue(), '');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'help-search', 'focus returns to the field');
  await search(page).fill('bande annonce');
  await page.keyboard.press('Escape');
  assert.equal(await search(page).inputValue(), '', 'Escape clears');
  await search(page).fill('zzzzqqqq');
  const empty = page.getByTestId('no-results');
  await empty.waitFor();
  await empty.getByText(/Aucun résultat pour « zzzzqqqq »/).waitFor();
  await empty.getByRole('button', { name: 'Effacer la recherche' }).click();
  assert.equal(await page.getByTestId('no-results').count(), 0);
  assert.ok((await titles(page)).length > 0, 'default articles are back');
  await context.close();
});

check('category filtering narrows the articles and the FAQ, combines with a query, and toggles off', async () => {
  const { context, page } = await anonymous(browser);
  await openHelp(page);
  const all = await page.locator('[data-testid="faq-section"] [data-accordion-item]').count();
  const profils = page.locator('[data-category="profils"]');
  await profils.click();
  assert.equal(await profils.getAttribute('aria-pressed'), 'true');
  const list = await titles(page);
  assert.ok(list.length >= 8);
  assert.ok(list.some((title) => /code PIN/.test(title)) && !list.some((title) => /mot de passe du compte/.test(title)));
  const faq = await page.locator('[data-testid="faq-section"] [data-accordion-item]').count();
  assert.ok(faq > 0 && faq < all, 'FAQ is filtered too');
  await search(page).fill('pin');
  assert.ok((await page.locator('[data-testid="article-list"] li').count()) > 0);
  await search(page).fill('bande annonce');
  await page.getByTestId('no-results').waitFor(); // trailers live in another category
  await page.getByRole('button', { name: 'Tout afficher' }).click();
  assert.equal(await profils.getAttribute('aria-pressed'), 'false');
  assert.equal(await search(page).inputValue(), '');
  await context.close();
});

check('the FAQ accordion opens and closes with mouse and keyboard, and hides collapsed answers from tab order and screen readers', async () => {
  const { context, page } = await anonymous(browser);
  await openHelp(page);
  const first = page.locator('[data-testid="faq-section"] button[aria-expanded]').first();
  const panelId = await first.getAttribute('aria-controls');
  const panel = page.locator(`[id="${panelId}"]`);
  assert.equal(await first.getAttribute('aria-expanded'), 'false');
  assert.equal(await panel.getAttribute('inert'), '', 'collapsed content is inert');
  assert.equal(await panel.getAttribute('role'), 'region');
  await first.click();
  assert.equal(await first.getAttribute('aria-expanded'), 'true');
  assert.equal(await panel.getAttribute('inert'), null);
  await page.waitForFunction((id) => document.getElementById(id).getBoundingClientRect().height > 20, panelId);
  await panel.getByRole('link', { name: 'Lire l’article complet' }).waitFor();
  await first.click();
  assert.equal(await first.getAttribute('aria-expanded'), 'false');
  await first.focus();
  await page.keyboard.press('Enter');
  assert.equal(await first.getAttribute('aria-expanded'), 'true', 'Enter opens');
  await page.keyboard.press('Space');
  assert.equal(await first.getAttribute('aria-expanded'), 'false', 'Space closes');
  await page.keyboard.press('ArrowDown');
  const second = page.locator('[data-testid="faq-section"] button[aria-expanded]').nth(1);
  assert.equal(await second.evaluate((el) => el === document.activeElement), true, 'ArrowDown moves to the next question');
  await page.keyboard.press('End');
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-expanded') !== null), true);
  await page.keyboard.press('Home');
  assert.equal(await first.evaluate((el) => el === document.activeElement), true, 'Home goes back to the first');
  await context.close();
});

check('the search field is reachable with the keyboard and the focus ring is visible', async () => {
  const { context, page } = await anonymous(browser);
  await openHelp(page);
  let reached = false;
  for (let i = 0; i < 12 && !reached; i++) { await page.keyboard.press('Tab'); reached = await page.evaluate(() => document.activeElement?.id === 'help-search'); }
  assert.ok(reached, 'Tab reaches the search field');
  await page.keyboard.type('code pin');
  assert.ok((await page.locator('[data-testid="article-list"] li').count()) > 0);
  const ring = await search(page).evaluate((el) => getComputedStyle(el).boxShadow);
  assert.notEqual(ring, 'none', 'a focus ring is drawn');
  await page.keyboard.press('Tab'); // clear button, then categories: all reachable
  await context.close();
});

const VIEWPORTS = [['small phone', { width: 320, height: 640 }], ['mobile', { width: 375, height: 812 }], ['tablet', { width: 768, height: 1024 }], ['desktop', { width: 1440, height: 900 }]];
for (const [vp, viewport] of VIEWPORTS) {
  check(`[${vp}] the Help Center and an article fit the screen without horizontal overflow`, async () => {
    const { context, page, errors } = await anonymous(browser, { viewport });
    await openHelp(page);
    await search(page).waitFor({ state: 'visible' });
    const box = await search(page).boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= viewport.width, 'search inside the viewport');
    assert.ok(box.height >= 44, `touch-friendly search field (${box.height}px)`);
    // the placeholder must fit inside the field: measure its real text width against the room the field leaves for it
    const fit = await search(page).evaluate((el) => {
      const placeholder = getComputedStyle(el, '::placeholder');
      const style = getComputedStyle(el);
      const context = document.createElement('canvas').getContext('2d');
      context.font = `${placeholder.fontStyle} ${placeholder.fontWeight} ${placeholder.fontSize} ${placeholder.fontFamily}`;
      return { text: context.measureText(el.placeholder).width, room: el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight), size: placeholder.fontSize };
    });
    assert.ok(fit.text <= fit.room, `placeholder is clipped: ${Math.round(fit.text)}px of text in ${Math.round(fit.room)}px (${fit.size})`);
    const overflow = async () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok((await overflow()) <= 0, `Help Center overflows by ${await overflow()}px`);
    await page.locator('[data-category="profils"]').click();
    assert.ok((await overflow()) <= 0, 'filtered view');
    await openHelp(page, '/help/ouvrir-un-profil-avec-son-code-pin');
    assert.ok((await overflow()) <= 0, 'article');
    assert.deepEqual(errors, []);
    await context.close();
  });
}

check('the contact section is a real support form that never asks for secrets and never claims an e-mail was sent', async () => {
  const { context, page } = await anonymous(browser);
  await openHelp(page);
  const section = page.locator('#contact:visible');
  await section.getByRole('heading', { name: 'Vous avez encore besoin d’aide ?' }).waitFor();
  const form = section.getByTestId('support-form');
  await form.waitFor();
  for (const label of ['Sujet', 'Catégorie', 'Adresse e-mail', 'Message']) await form.getByLabel(label, { exact: true }).waitFor();
  assert.equal(await page.locator('a[href^="mailto:"]').count(), 0, 'no invented address (no NEXT_PUBLIC_SUPPORT_EMAIL in this build)');
  await section.getByText(/Aucun e-mail de confirmation n’est envoyé automatiquement/).first().waitFor();
  await section.getByText(/N’écrivez jamais votre mot de passe, un code PIN ou un jeton de connexion/).waitFor();
  assert.equal(await form.locator('input[type="password"]').count(), 0, 'the form has no password field');
  await context.close();
});

check('back to top appears after scrolling and works; reduced motion removes the accordion transition', async () => {
  const { context, page } = await anonymous(browser, { reducedMotion: 'reduce' });
  await openHelp(page);
  assert.equal(await page.getByRole('button', { name: 'Revenir en haut de la page' }).count(), 0);
  await page.evaluate(() => window.scrollTo(0, 1600));
  const top = page.getByRole('button', { name: 'Revenir en haut de la page' });
  await top.waitFor();
  await top.click();
  await page.waitForFunction(() => window.scrollY < 5);
  const transition = await page.locator('[data-testid="faq-section"] [role="region"]').first().evaluate((el) => getComputedStyle(el).transitionProperty);
  assert.equal(transition, 'none', 'no accordion animation under prefers-reduced-motion');
  await context.close();
});

check('a signed-in member reaches the Help Center from the navbar menu without any PIN, loader or profile change', async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const email = `help-ui-${Date.now()}-${Math.round(Math.random() * 1e6)}@example.com`;
  await page.goto(`${BASE}/login`);
  await page.getByRole('button', { name: 'Inscription' }).click();
  await page.getByLabel('Nom').fill('Help Tester');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.locator('form input').nth(2).fill(PASSWORD);
  await page.getByRole('button', { name: 'Créer le compte' }).click();
  await page.waitForURL(/\/profiles/, { timeout: 20000 });
  assert.equal((await page.request.post(`${BASE}/api/profiles`, { data: { name: 'Alex', avatar: 'ember', isKids: false, maturityLevel: 18, preferences: [], language: 'fr-FR', pin: PIN, confirmPin: PIN } })).status(), 201);
  await page.goto(`${BASE}/profiles`);
  await page.getByRole('button', { name: 'Continuer avec Alex' }).click();
  await page.waitForURL(/\/unlock$/, { timeout: 20000 });
  await page.locator('#profile-pin').waitFor({ state: 'attached' });
  await page.keyboard.type(PIN, { delay: 40 });
  await page.waitForURL(`${BASE}/`, { timeout: 40000 });
  await page.getByText('Recommandé pour Alex').first().waitFor({ timeout: 20000 });
  const before = (await (await page.request.get(`${BASE}/api/profiles`)).json()).selectedProfileId;
  assert.ok(before, 'a profile is selected');
  await page.waitForFunction(() => !document.querySelector('[data-cinematic-transition]'), null, { timeout: 30000 }); // let the unlock intro finish first

  await page.evaluate(() => {
    window.__overlays = 0;
    new MutationObserver(() => { if (document.querySelector('[data-cinematic-transition]')) window.__overlays++; }).observe(document, { childList: true, subtree: true });
  });
  await page.getByRole('button', { name: 'Ouvrir le menu du profil' }).click();
  await page.getByRole('menuitem', { name: /Centre d.aide/ }).click();
  await page.waitForURL(/\/help$/, { timeout: 15000 });
  await page.getByRole('heading', { name: 'Comment pouvons-nous vous aider ?' }).waitFor();
  assert.equal(await page.getByRole('link', { name: 'Se connecter' }).count(), 0, 'members get the normal navbar');
  await page.locator('nav').first().waitFor();
  await page.locator('[data-category="profils"]').click();
  await page.locator('[data-testid="article-list"] a').first().click();
  await page.waitForURL(/\/help\/[a-z-]+$/);
  assert.equal(await page.evaluate(() => window.__overlays), 0, 'the cinematic loader never ran');
  assert.equal(await page.locator('#profile-pin').count(), 0, 'no PIN screen');
  const after = (await (await page.request.get(`${BASE}/api/profiles`)).json()).selectedProfileId;
  assert.equal(after, before, 'the selected profile is unchanged');
  await context.close();
});

const browser = await chromium.launch();
let failed = 0;
for (const { name, fn } of results) {
  try { await fn(); console.log(`PASS  ${name}`); }
  catch (error) { failed++; console.log(`FAIL  ${name}\n      ${String(error.message).split('\n').slice(0, 3).join(' | ').slice(0, 400)}`); }
}
await browser.close();
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
