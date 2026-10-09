/* global document, window */
// Browser tests for the support form, the admin ticket area, the footer and the legal pages (real Chromium).
//
//   npm i -D playwright && npx playwright install chromium     (not a project dependency)
//   E2E_BASE_URL=http://localhost:4101 [E2E_GRANT_ADMIN_COMMAND="bash grant-admin.sh"] node tests/browser/support-flow.mjs
//
// Point it at a production server backed by an ISOLATED test database: it registers accounts and creates and deletes
// tickets. E2E_GRANT_ADMIN_COMMAND (a shell command run with ADMIN_EMAIL in its environment, see tests/support.integration.test.ts)
// is needed for the admin check, which is skipped without it.
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { chromium } from 'playwright';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4101';
const GRANT = process.env.E2E_GRANT_ADMIN_COMMAND;
const PASSWORD = 'Browser-Test-Pass-9x';
const PIN = '7392';
const run = Date.now();
let ipCounter = 0;
const nextIp = () => `10.${(run % 200) + 1}.77.${(++ipCounter % 250) + 1}`;
const results = [];
const check = (name, fn, options = {}) => results.push({ name, fn, skip: options.skip });

const register = async (browser, { profile = false } = {}) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const email = `support-ui-${run}-${Math.round(Math.random() * 1e6)}@example.com`;
  await page.goto(`${BASE}/login`);
  await page.getByRole('button', { name: 'Inscription' }).click();
  await page.getByLabel('Nom').fill('Support Tester');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.locator('form input').nth(2).fill(PASSWORD);
  await page.getByRole('button', { name: 'Créer le compte' }).click();
  await page.waitForURL(/\/profiles/, { timeout: 20000 });
  if (profile) {
    assert.equal((await page.request.post(`${BASE}/api/profiles`, { data: { name: 'Alex', avatar: 'ember', isKids: false, maturityLevel: 18, preferences: [], language: 'fr-FR', pin: PIN, confirmPin: PIN } })).status(), 201);
    await page.goto(`${BASE}/profiles`);
    await page.getByRole('button', { name: 'Continuer avec Alex' }).click();
    await page.waitForURL(/\/unlock$/, { timeout: 20000 });
    await page.locator('#profile-pin').waitFor({ state: 'attached' });
    await page.keyboard.type(PIN, { delay: 40 });
    await page.waitForURL(`${BASE}/`, { timeout: 40000 });
    await page.waitForFunction(() => !document.querySelector('[data-cinematic-transition]'), null, { timeout: 30000 });
  }
  return { context, page, email };
};

const anonymousPage = async (browser, viewport = { width: 1440, height: 900 }) => {
  const context = await browser.newContext({ viewport });
  return { context, page: await context.newPage() };
};

const fillForm = async (page, { subject, category = 'Assistance technique', email, message }) => {
  const form = page.getByTestId('support-form');
  if (subject !== undefined) await form.getByLabel('Sujet', { exact: true }).fill(subject);
  if (category) await form.getByLabel('Catégorie', { exact: true }).selectOption({ label: category });
  if (email !== undefined) await form.getByLabel('Adresse e-mail', { exact: true }).fill(email);
  if (message !== undefined) await form.getByLabel('Message', { exact: true }).fill(message);
  return form;
};
// React's hidden streaming buffer briefly holds a second copy of the page, so only the visible section counts.
const openHelp = async (page) => { await page.goto(`${BASE}/help`); await page.locator('#contact:visible').waitFor({ timeout: 20000 }); };

check('the support form validates in the browser before sending anything, and refuses secrets', async () => {
  const { context, page } = await anonymousPage(browser);
  const posts = [];
  page.on('request', (request) => { if (request.method() === 'POST' && request.url().endsWith('/api/support')) posts.push(request.url()); });
  await openHelp(page);
  const form = page.getByTestId('support-form');
  await form.getByRole('button', { name: 'Envoyer ma demande' }).click();
  for (const text of [/sujet doit contenir/, /Choisissez une catégorie/, /adresse e-mail valide/, /Décrivez votre demande/]) await form.getByText(text).waitFor();
  assert.equal(await form.getByLabel('Sujet', { exact: true }).getAttribute('aria-invalid'), 'true');
  await fillForm(page, { subject: 'Un problème de PIN', email: 'a@example.com', message: 'Bonjour, mon code PIN est 7392 et rien ne fonctionne vraiment.' });
  await form.getByRole('button', { name: 'Envoyer ma demande' }).click();
  await form.getByText(/semble contenir un mot de passe, un code PIN ou un jeton/).waitFor();
  assert.equal(posts.length, 0, 'nothing was sent');
  await context.close();
});

check('a visitor sends a request: success appears only after it is stored, with a reference and no e-mail claim', async () => {
  const { context, page } = await anonymousPage(browser);
  await page.route('**/api/support', (route) => route.continue({ headers: { ...route.request().headers(), 'x-forwarded-for': nextIp() } }));
  const posts = [];
  page.on('request', (request) => { if (request.method() === 'POST' && request.url().endsWith('/api/support')) posts.push(request.postDataJSON()); });
  await openHelp(page);
  const form = await fillForm(page, { subject: 'Écran de chargement bloqué', email: `visitor-${run}-a@example.com`, message: 'Depuis ce matin, l’écran de chargement reste bloqué à 90 % sur mon téléphone après le code PIN.' });
  await page.waitForTimeout(2600); // the form was open long enough to be a person
  await form.getByRole('button', { name: 'Envoyer ma demande' }).dblclick();
  await page.getByTestId('support-success').waitFor({ timeout: 15000 });
  assert.match(await page.getByTestId('support-reference').textContent(), /^CV-[0-9A-Z]{8}$/);
  await page.getByTestId('support-success').getByText(/aucun e-mail de confirmation n’a été envoyé/i).waitFor();
  assert.equal(posts.length, 1, 'a double click sends one request');
  assert.equal(posts[0].website, '', 'the honeypot stays empty');
  assert.ok(posts[0].elapsedMs >= 2500);
  assert.ok(!('userId' in posts[0]), 'no identity is sent by the browser');
  assert.equal(await page.getByTestId('support-form').count(), 0);
  await page.getByRole('button', { name: 'Envoyer une autre demande' }).click();
  await page.getByTestId('support-form').waitFor();
  assert.equal(await page.getByLabel('Sujet', { exact: true }).inputValue(), '', 'the form is empty again');
  await context.close();
});

check('failures are reported truthfully: rate limit, server unavailable, network loss — never a success message', async () => {
  const { context, page } = await anonymousPage(browser);
  await openHelp(page);
  const send = async () => {
    const form = await fillForm(page, { subject: 'Test des erreurs', email: 'a@example.com', message: 'Ceci est un message de test assez long pour être accepté par le formulaire.' });
    await page.waitForTimeout(2600);
    await form.getByRole('button', { name: 'Envoyer ma demande' }).click();
  };
  await page.route('**/api/support', (route) => route.fulfill({ status: 429, contentType: 'application/json', headers: { 'Retry-After': '1800' }, body: JSON.stringify({ error: 'Vous avez envoyé trop de demandes récemment. Réessayez plus tard.', code: 'RATE_LIMITED', retryAfterSeconds: 1800 }) }));
  await send();
  await page.getByTestId('support-error').getByText(/trop de demandes.*30 minutes/).waitFor();
  await page.unroute('**/api/support');
  await page.route('**/api/support', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Le support n’est pas encore activé sur ce serveur. Votre demande n’a pas été enregistrée.', code: 'SUPPORT_UNAVAILABLE' }) }));
  await page.getByRole('button', { name: 'Envoyer ma demande' }).click();
  await page.getByTestId('support-error').getByText(/n’a pas été enregistrée/).waitFor();
  await page.unroute('**/api/support');
  await page.route('**/api/support', (route) => route.abort('failed'));
  await page.getByRole('button', { name: 'Envoyer ma demande' }).click();
  await page.getByTestId('support-error').getByText(/Connexion impossible : votre demande n’a pas été envoyée/).waitFor();
  assert.equal(await page.getByTestId('support-success').count(), 0, 'no success was ever shown');
  await context.close();
});

check('the honeypot is invisible and unreachable for real visitors', async () => {
  const { context, page } = await anonymousPage(browser);
  await openHelp(page);
  const box = await page.locator('#support-website').boundingBox();
  assert.ok(!box || box.x < -1000 || box.width <= 1, 'moved off-screen');
  assert.equal(await page.locator('#support-website').getAttribute('tabindex'), '-1');
  await context.close();
});

for (const [name, path] of [['Politique de confidentialité', '/privacy'], ['Cookies', '/cookies'], ['Conditions d’utilisation', '/terms'], ['Accessibilité', '/accessibility'], ['Mentions légales', '/legal-notice']]) {
  check(`${path}: a public draft that is clearly marked, not indexed, accurate on the key facts, and fits a 320px phone`, async () => {
    const { context, page } = await anonymousPage(browser, { width: 320, height: 640 });
    const response = await page.goto(`${BASE}${path}`);
    assert.equal(response.status(), 200);
    assert.match(page.url(), new RegExp(`${path}$`), 'no login redirect');
    await page.getByTestId('legal-title').waitFor();
    assert.equal((await page.getByTestId('legal-title').textContent()).trim(), name);
    await page.getByTestId('draft-banner').getByText(/Projet de document, à relire par le propriétaire avant publication/).waitFor();
    assert.match(await page.locator('meta[name="robots"]').getAttribute('content'), /noindex/);
    assert.ok((await page.locator('[data-todo]').count()) >= 1, 'owner-only values are marked');
    const body = await page.locator('article').innerText();
    if (path === '/privacy') for (const needle of ['Supabase', 'TMDB', 'static.rocket.new', 'Télécharger mes données', 'demandes d’aide']) assert.ok(body.includes(needle), `privacy mentions ${needle}`);
    if (path === '/cookies') for (const needle of ['next-auth.session-token', 'next-auth.csrf-token', 'next-auth.callback-url', 'cv-unlock', 'stockage local']) assert.ok(body.includes(needle), `cookies mention ${needle}`);
    if (path === '/terms') for (const needle of ['ne permet pas de regarder les films et séries en entier', 'n’est ni approuvé ni certifié par TMDB']) assert.ok(body.includes(needle), `terms state ${needle}`);
    if (path === '/accessibility') assert.ok(body.includes('Aucun niveau de conformité'), 'no conformity claim');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 0, `overflows by ${overflow}px`);
    for (const href of await page.locator('article a[href^="/"]').evaluateAll((links) => links.map((link) => link.getAttribute('href').split('#')[0]))) {
      assert.ok([200, 307].includes((await page.request.get(`${BASE}${href}`, { maxRedirects: 0 })).status()), `${href} exists`);
    }
    await context.close();
  });
}

check('every footer link leads to a real page (none is a placeholder), and the legal links open the new pages', async () => {
  const { context, page } = await anonymousPage(browser);
  await openHelp(page);
  const links = await page.locator('footer a').evaluateAll((items) => items.map((item) => ({ text: item.textContent.trim(), href: item.getAttribute('href') })));
  assert.ok(links.length >= 15);
  for (const link of links) {
    if (link.text !== 'Accueil') assert.notEqual(link.href, '/', `${link.text} is not a placeholder`);
    const status = (await page.request.get(`${BASE}${link.href.split('#')[0]}`, { maxRedirects: 0 })).status();
    assert.ok([200, 307].includes(status), `${link.text} -> ${link.href} answered ${status}`);
  }
  assert.ok(!links.some((link) => link.text === 'Presse'), 'the placeholder "Presse" link was removed');
  const expected = { Accessibilité: '/accessibility', Cookies: '/cookies', CGU: '/terms', Confidentialité: '/privacy', 'Mentions légales': '/legal-notice' };
  for (const [text, href] of Object.entries(expected)) assert.equal(links.find((link) => link.text === text)?.href, href);
  await page.locator('footer').getByRole('link', { name: 'Confidentialité' }).click();
  await page.waitForURL(/\/privacy$/);
  await context.close();
});

check('a signed-in member: the form suggests the account e-mail, and the footer genre links preselect the catalogue filter', async () => {
  const { context, page, email } = await register(browser, { profile: true });
  await openHelp(page);
  assert.equal(await page.getByLabel('Adresse e-mail', { exact: true }).inputValue(), email, 'account e-mail suggested');
  await page.goto(`${BASE}/`);
  await page.locator('footer').getByRole('link', { name: 'Action' }).click();
  await page.waitForURL(/genre=28/);
  await page.locator('select.filter-select').first().waitFor({ timeout: 20000 });
  const selected = await page.locator('select.filter-select').evaluateAll((selects) => selects.map((select) => select.options[select.selectedIndex]?.text));
  assert.ok(selected.includes('Action'), `the genre filter shows Action (${selected.join(', ')})`);
  await context.close();
});

check('an ordinary member gets the plain "Page Not Found" page for /admin, with no administration shell and no admin data', async () => {
  const { context, page } = await register(browser);
  await page.goto(`${BASE}/admin/support`);
  await page.getByRole('heading', { name: 'Page Not Found' }).waitFor({ timeout: 20000 });
  assert.equal(await page.getByTestId('back-to-site').count(), 0, 'no administration sidebar');
  for (const path of ['/admin/support/tickets', '/admin/support/knowledge-base', '/admin/support/analytics', '/admin/support/settings', '/admin/support/audit', '/admin/support/notifications']) {
    await page.goto(`${BASE}${path}`);
    await page.getByRole('heading', { name: 'Page Not Found' }).waitFor({ timeout: 20000 });
  }
  for (const path of ['/api/admin/support/tickets', '/api/admin/support/overview', '/api/admin/support/audit']) assert.equal((await page.request.get(`${BASE}${path}`)).status(), 404, path);
  await context.close();
});

check('support staff open the administration from the account page; ordinary members have no link', async () => {
  const subject = `Ticket navigateur ${run}`;
  const { context: memberContext, page: memberPage } = await register(browser);
  await memberPage.goto(`${BASE}/account`);
  await memberPage.locator('[data-section="overview"]').waitFor({ timeout: 20000 });
  assert.equal(await memberPage.getByRole('link', { name: /Ouvrir les demandes d’aide/ }).count(), 0, 'no admin link for ordinary members');
  await memberPage.getByTestId('my-support-link').waitFor();
  await memberContext.close();

  const { context, page, email } = await register(browser);
  const created = await page.request.post(`${BASE}/api/support`, { data: { subject, category: 'other', email: `visitor-${run}-z@example.com`, message: 'Message laissé par un visiteur pour tester l’espace de suivi des demandes.', elapsedMs: 9000 }, headers: { 'x-forwarded-for': nextIp() } });
  assert.equal(created.status(), 201);
  const reference = (await created.json()).reference;
  execSync(GRANT, { env: { ...process.env, ADMIN_EMAIL: email }, stdio: 'ignore' }); // restarts the isolated stack
  await page.goto(`${BASE}/login`);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.locator('form input[type="password"]').first().fill(PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL(/\/profiles/, { timeout: 30000 });

  await page.goto(`${BASE}/account`);
  await page.getByRole('link', { name: /Ouvrir les demandes d’aide/ }).click();
  await page.waitForURL(/\/admin\/support$/);
  await page.getByTestId('back-to-site').first().waitFor({ timeout: 20000 });
  await page.goto(`${BASE}/admin/support/tickets?q=${reference}`);
  const row = page.locator(`[data-testid="ticket-table"] [data-ticket="${reference}"]`);
  await row.waitFor({ timeout: 20000 });
  await row.getByRole('link', { name: new RegExp(subject) }).click();
  await page.getByTestId('ticket-reference').getByText(reference).waitFor();
  // sent while signed in, so the ticket belongs to an account and can receive an in-app reply
  await page.getByLabel('Votre réponse à l’auteur').fill('Merci pour votre message, nous regardons cela.');
  await page.getByTestId('send-message').click();
  await page.getByTestId('ticket-notice').getByText(/Réponse publiée/).waitFor({ timeout: 10000 });
  await page.getByLabel('Statut', { exact: true }).selectOption('in_progress');
  await page.getByTestId('ticket-notice').getByText(/Statut : En cours/).waitFor({ timeout: 10000 });
  await page.locator('[data-visibility="internal"]').click();
  await page.getByLabel(/Votre note interne/).fill('Pris en charge par le support.');
  await page.getByTestId('send-message').click();
  await page.getByTestId('ticket-notice').getByText('Note interne ajoutée.').waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: 'Supprimer la demande' }).click();
  await page.getByRole('button', { name: 'Supprimer', exact: true }).click();
  await page.waitForURL(/\/admin\/support\/tickets$/, { timeout: 15000 });
  await context.close();
}, { skip: !GRANT });

const browser = await chromium.launch();
let failed = 0;
let skipped = 0;
for (const { name, fn, skip } of results) {
  if (skip) { skipped++; console.log(`SKIP  ${name}`); continue; }
  try { await fn(); console.log(`PASS  ${name}`); }
  catch (error) { failed++; console.log(`FAIL  ${name}\n      ${String(error.message).split('\n').slice(0, 3).join(' | ').slice(0, 400)}`); }
}
await browser.close();
console.log(`\n${results.length - failed - skipped}/${results.length - skipped} passed${skipped ? ` (${skipped} skipped)` : ''}`);
process.exit(failed ? 1 : 0);
