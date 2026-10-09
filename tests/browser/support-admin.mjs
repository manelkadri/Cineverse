/* global document, window */
// Browser tests for the support administration (real Chromium): shell, overview, tickets, conversation, notifications,
// knowledge base, analytics, settings, audit log, responsiveness and keyboard use.
//
//   npm i -D playwright && npx playwright install chromium     (not a project dependency)
//   E2E_BASE_URL=http://localhost:4101 E2E_GRANT_ADMIN_COMMAND="bash grant-admin.sh" node tests/browser/support-admin.mjs
//
// Point it at a production server backed by an ISOLATED test database: it registers accounts, grants one of them support
// administration (E2E_GRANT_ADMIN_COMMAND restarts the isolated stack) and creates, edits and deletes tickets and articles.
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { chromium } from 'playwright';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4101';
const GRANT = process.env.E2E_GRANT_ADMIN_COMMAND;
if (!GRANT) { console.log('E2E_GRANT_ADMIN_COMMAND is required'); process.exit(2); }
const PASSWORD = 'Browser-Test-Pass-9x';
const run = Date.now();
let ipCounter = 0;
const nextIp = () => `10.${(run % 200) + 1}.88.${(++ipCounter % 250) + 1}`;
const results = [];
const check = (name, fn) => results.push({ name, fn });

const register = async (browser, label) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const email = `sadmin-${label}-${run}-${Math.round(Math.random() * 1e6)}@example.com`;
  await go(page, `${BASE}/login`);
  await page.getByRole('button', { name: 'Inscription' }).click();
  await page.getByLabel('Nom').fill(`Testeur ${label}`);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.locator('form input').nth(2).fill(PASSWORD);
  await page.getByRole('button', { name: 'Créer le compte' }).click();
  await page.waitForURL(/\/profiles/, { timeout: 20000 });
  return { context, page, email };
};
const login = async (page, email) => {
  await page.context().clearCookies(); // a signed-in visitor would be sent on by /login
  await go(page, `${BASE}/login`);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.locator('form input[type="password"]').first().fill(PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL(/\/profiles/, { timeout: 30000 });
};
const createTicket = async (page, subject, message) => {
  const response = await page.request.post(`${BASE}/api/support`, { data: { subject, category: 'technical', email: `contact-${run}@example.com`, message, elapsedMs: 9000 }, headers: { 'x-forwarded-for': nextIp() } });
  assert.equal(response.status(), 201, await response.text());
  return (await response.json()).reference;
};
// A page streamed from the server briefly exists twice (a hidden copy that React swaps in): wait for the swap before querying.
const go = async (target, url) => {
  await target.goto(url);
  await target.waitForFunction(() => !document.querySelector('body > div[hidden] main, body > div[hidden] h1'), null, { timeout: 30000 });
};
const noOverflow = async (page, label) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, `${label} overflows horizontally by ${overflow}px`);
};

const browser = await chromium.launch();
const admin = await register(browser, 'admin');
const member = await register(browser, 'member');
const XSS = '<img src=x onerror="window.__xss=1"><script>window.__xss=1</script>';
const memberSubject = `Panne lecture ${run}`;
const guestSubject = `Question visiteur ${run}`;
const memberRef = await createTicket(member.page, memberSubject, `Je n’arrive plus à lancer une bande-annonce depuis hier. ${XSS}`);
const guestContext = await browser.newContext();
const guestRef = await createTicket(await guestContext.newPage(), guestSubject, 'Question posée par un visiteur sans compte, pour tester le suivi des demandes.');
execSync(GRANT, { env: { ...process.env, ADMIN_EMAIL: admin.email }, stdio: 'ignore' }); // restarts the isolated stack
await login(admin.page, admin.email);
await login(member.page, member.email);
const page = admin.page;
const ticketId = async (reference) => {
  const body = await (await page.request.get(`${BASE}/api/admin/support/tickets?q=${reference}`)).json();
  return body.tickets.find((ticket) => ticket.reference === reference).id;
};

check('the shell: sidebar sections, Retour à CINEVERSE, breadcrumbs, active item and account info', async () => {
  await go(page, `${BASE}/admin/support`);
  await page.getByTestId('kpis').waitFor({ timeout: 30000 });
  const nav = page.getByRole('navigation', { name: 'Administration du support' });
  for (const label of ['Vue d’ensemble', 'Demandes d’aide', 'Notifications', 'Base de connaissances', 'Statistiques', 'Paramètres']) await nav.getByRole('link', { name: new RegExp(label) }).waitFor();
  assert.equal(await nav.locator('[aria-current="page"]').count(), 1);
  assert.match(await nav.locator('[aria-current="page"]').innerText(), /Vue d’ensemble/);
  await page.getByTestId('back-to-site').first().waitFor();
  await page.getByTestId('admin-account').getByText(/Testeur admin/).waitFor();
  await nav.getByRole('link', { name: /Base de connaissances/ }).click();
  await page.waitForURL(/knowledge-base$/);
  await page.getByRole('navigation', { name: 'Fil d’Ariane' }).getByText('Base de connaissances').waitFor();
  assert.match(await page.getByRole('navigation', { name: 'Administration du support' }).locator('[aria-current="page"]').innerText(), /Base de connaissances/);
  await page.getByTestId('back-to-site').first().click();
  await page.waitForURL(`${BASE}/`, { timeout: 15000 }).catch(() => page.waitForURL(/\/(profiles|unlock)/, { timeout: 15000 }));
});

check('overview: real KPIs, recent requests and activity', async () => {
  await go(page, `${BASE}/admin/support`);
  await page.getByTestId('kpis').waitFor({ timeout: 30000 });
  const total = Number(await page.locator('[data-kpi="Total"]').innerText());
  assert.ok(total >= 2, `total shows ${total}`);
  assert.ok(Number(await page.locator('[data-kpi="Ouvertes"]').innerText()) >= 2);
  await page.getByText(memberSubject).first().waitFor();
});

check('tickets: search by reference/subject, status filter, sort, reset, and the empty state', async () => {
  await go(page, `${BASE}/admin/support/tickets`);
  await page.getByTestId('ticket-table').waitFor({ timeout: 30000 });
  await page.locator('[data-testid="ticket-search"]:visible').fill(memberRef);
  await page.waitForURL(new RegExp(`q=${memberRef}`));
  await page.getByTestId('ticket-count').getByText(/^1 demande/).waitFor();
  await page.locator(`[data-testid="ticket-table"] [data-ticket="${memberRef}"]`).waitFor();
  assert.equal(await page.locator('[data-testid="ticket-table"] tbody tr').count(), 1);
  await page.locator('[data-testid="ticket-search"]:visible').fill(guestSubject.slice(0, 18));
  await page.locator(`[data-testid="ticket-table"] [data-ticket="${guestRef}"]`).waitFor();
  await page.getByLabel('Statut', { exact: true }).selectOption('resolved');
  await page.getByTestId('admin-empty').waitFor();
  await page.getByTestId('reset-filters').click();
  await page.locator(`[data-testid="ticket-table"] [data-ticket="${memberRef}"]`).waitFor();
  await page.getByLabel('Tri').selectOption('oldest');
  await page.waitForURL(/sort=oldest/);
  await page.waitForFunction((ref) => document.querySelector('[data-testid="ticket-table"] tbody tr')?.getAttribute('data-ticket') === ref, memberRef);
  const refs = await page.locator('[data-testid="ticket-table"] tbody tr').evaluateAll((rows) => rows.map((row) => row.getAttribute('data-ticket')));
  assert.ok(refs.indexOf(memberRef) < refs.indexOf(guestRef), 'oldest first');
});

check('ticket detail: priority, assignment (existing admins only), status; a guest ticket cannot receive a public reply', async () => {
  await go(page, `${BASE}/admin/support/tickets/${await ticketId(guestRef)}`);
  await page.getByTestId('ticket-reference').waitFor({ timeout: 30000 });
  await page.getByTestId('no-delivery').waitFor();
  assert.equal(await page.locator('[data-visibility="public"]').isDisabled(), true);
  await page.getByLabel('Priorité', { exact: true }).selectOption('urgent');
  await page.getByTestId('ticket-notice').getByText('Priorité mise à jour.').waitFor({ timeout: 10000 });
  const options = await page.getByLabel('Assignée à').locator('option').allInnerTexts();
  assert.ok(options.some((text) => /Testeur admin/.test(text)) && !options.some((text) => /Testeur member/.test(text)), `only admins are offered: ${options.join(', ')}`);
  await page.getByLabel('Assignée à').selectOption({ label: options.find((text) => /Testeur admin/.test(text)) });
  await page.getByTestId('ticket-notice').getByText('Assignation enregistrée.').waitFor({ timeout: 10000 });
  await page.getByTestId('ticket-history').getByText('Assignation modifiée').waitFor();
});

check('conversation: a public reply reaches the member, a private note never does, and the member can follow up', async () => {
  const id = await ticketId(memberRef);
  await go(page, `${BASE}/admin/support/tickets/${id}`);
  await page.getByTestId('conversation').waitFor({ timeout: 30000 });
  assert.equal(await page.evaluate(() => window.__xss), undefined, 'the stored payload did not execute');
  await page.getByText(/<img src=x onerror/).first().waitFor();
  await page.getByLabel('Votre réponse à l’auteur').fill('Bonjour, essayez de vider le cache de votre navigateur puis de relancer la lecture.');
  await page.getByTestId('send-message').click();
  await page.getByTestId('ticket-notice').getByText(/Réponse publiée/).waitFor({ timeout: 10000 });
  await page.locator('[data-visibility="internal"]').click();
  await page.getByLabel('Votre note interne').fill('SECRET-INTERNE : client probablement sur un ancien navigateur.');
  await page.getByTestId('send-message').click();
  await page.getByTestId('ticket-notice').getByText('Note interne ajoutée.').waitFor({ timeout: 10000 });
  assert.equal(await page.locator('[data-message-tone="internal"]').count(), 1);
  assert.equal(await page.locator('[data-message-tone="staff"]').count(), 1);

  const m = member.page;
  await go(m, `${BASE}/account/support`);
  const card = m.locator(`[data-testid="account-tickets"] [data-ticket="${memberRef}"]`);
  await card.waitFor({ timeout: 30000 });
  await card.getByText('Réponse de l’équipe').waitFor();
  await card.click();
  await m.getByTestId('conversation').waitFor();
  await m.getByText(/vider le cache/).waitFor();
  assert.equal(await m.getByText('SECRET-INTERNE').count(), 0, 'private note is not visible to the member');
  assert.equal(await m.evaluate(() => window.__xss), undefined, 'no script ran for the member either');
  await m.getByTestId('member-reply').fill('Merci, cela fonctionne maintenant, mais pouvez-vous confirmer la cause ?');
  await m.getByTestId('member-send').click();
  await m.getByTestId('member-notice').getByText('Message envoyé à l’équipe.').waitFor({ timeout: 10000 });
  await m.getByText(/pouvez-vous confirmer la cause/).waitFor();

  await page.reload();
  await page.getByText(/pouvez-vous confirmer la cause/).waitFor({ timeout: 20000 });
  await page.getByText('En attente de l’équipe').waitFor();
});

check('another member cannot open this ticket, and a guest reference alone shows nothing', async () => {
  const other = await register(browser, 'other');
  const id = await ticketId(memberRef);
  assert.equal((await other.page.request.get(`${BASE}/api/account/support/tickets/${id}`)).status(), 404);
  await go(other.page, `${BASE}/account/support/${id}`);
  await other.page.getByText('Demande introuvable.').waitFor({ timeout: 20000 });
  await go(other.page, `${BASE}/account/support`);
  await other.page.getByTestId('account-support-empty').waitFor({ timeout: 20000 });
  await other.context.close();
});

check('notifications: the admin is told about the member reply; mark one, then all, as read', async () => {
  await go(page, `${BASE}/admin/support/notifications`);
  const list = page.getByTestId('admin-notifications');
  await list.waitFor({ timeout: 30000 });
  await list.getByText('Nouvelle réponse d’un utilisateur').first().waitFor();
  const unread = Number(await list.getAttribute('data-unread'));
  assert.ok(unread >= 1);
  const [readAll] = await Promise.all([page.waitForResponse((response) => response.url().endsWith('/api/admin/support/notifications/read-all')), page.getByTestId('mark-all-read').click()]);
  assert.equal(readAll.status(), 200, await readAll.text());
  await page.waitForFunction(() => Number(document.querySelector('[data-testid="admin-notifications"]')?.dataset.unread ?? 0) === 0);
  await page.getByRole('tab', { name: /Non lues/ }).click();
  await page.getByTestId('notifications-empty').waitFor();
  await page.getByRole('tab', { name: 'Toutes' }).click();
  await page.getByTestId('admin-notifications').locator('[data-read="true"]').first().waitFor();
  const [patch] = await Promise.all([page.waitForResponse((response) => /\/api\/notifications\/[^/]+$/.test(response.url()) && response.request().method() === 'PATCH'), page.getByTestId('admin-notifications').locator('[data-read="true"]').first().getByRole('button', { name: 'Marquer non lue' }).click()]);
  assert.equal(patch.status(), 200, await patch.text());
  await page.waitForFunction(() => Number(document.querySelector('[data-testid="admin-notifications"]')?.dataset.unread ?? 0) === 1);
});

check('knowledge base: built-in content listed, edit + publish a built-in article, restore the original, create/publish/hide a new one', async () => {
  const articles = (await (await page.request.get(`${BASE}/api/admin/support/kb/articles`)).json()).articles;
  assert.ok(articles.length >= 34);
  const target = articles[0];
  await go(page, `${BASE}/admin/support/knowledge-base`);
  await page.getByTestId('kb-articles').waitFor({ timeout: 30000 });
  assert.ok((await page.locator('[data-testid="kb-articles"] > li').count()) >= 34);
  await go(page, `${BASE}/admin/support/knowledge-base/articles/${target.slug}`);
  await page.getByTestId('article-title').waitFor({ timeout: 30000 });
  const modified = `${target.title} (relu ${run})`;
  await page.getByTestId('article-title').fill(modified);
  await page.getByTestId('article-content').fill(`## Section\n${XSS}\n\n1. Première étape\n2. Seconde étape`);
  await page.getByTestId('article-preview').getByText(/Première étape/).waitFor();
  assert.equal(await page.evaluate(() => window.__xss), undefined, 'the preview shows HTML as text');
  await page.getByTestId('article-save').click(); // a built-in article is already published: saving publishes the new version
  await page.getByTestId('article-notice').getByText('Enregistré et publié.').waitFor({ timeout: 10000 });
  await go(page, `${BASE}/help/${target.slug}`);
  await page.getByText(modified).first().waitFor({ timeout: 30000 });
  await go(page, `${BASE}/admin/support/knowledge-base`);
  const item = page.locator(`[data-article="${target.slug}"]`);
  await item.waitFor();
  await item.locator('[data-action="delete"]').click();
  await page.getByTestId('kb-confirm-yes').click();
  await page.getByTestId('kb-notice').getByText('Version d’origine restaurée.').waitFor({ timeout: 10000 });
  await go(page, `${BASE}/help/${target.slug}`);
  await page.getByText(target.title).first().waitFor({ timeout: 30000 });
  assert.equal(await page.getByText(modified).count(), 0);

  const title = `Article de test ${run}`;
  await go(page, `${BASE}/admin/support/knowledge-base/articles/new`);
  await page.getByTestId('article-title').fill(title);
  await page.getByTestId('article-summary').fill('Un résumé pour un article de test.');
  await page.getByTestId('article-content').fill('Un paragraphe de test.');
  await page.getByTestId('article-save').click();
  await page.waitForURL(/articles\/article-de-test/, { timeout: 15000 });
  const slug = new URL(page.url()).pathname.split('/').pop();
  assert.equal((await page.request.get(`${BASE}/help/${slug}`)).status(), 404, 'a draft is not public');
  await page.getByTestId('article-publish').click();
  await page.getByTestId('article-notice').getByText('Enregistré et publié.').waitFor({ timeout: 10000 });
  assert.equal((await page.request.get(`${BASE}/help/${slug}`)).status(), 200, 'published');
  await go(page, `${BASE}/admin/support/knowledge-base`);
  await page.locator(`[data-article="${slug}"] [data-action="hide"]`).click();
  await page.getByTestId('kb-notice').getByText(/masqué/).waitFor({ timeout: 10000 });
  assert.equal((await page.request.get(`${BASE}/help/${slug}`)).status(), 404, 'hidden');
  await page.locator(`[data-article="${slug}"] [data-action="delete"]`).click();
  await page.getByTestId('kb-confirm-yes').click();
  await page.getByTestId('kb-notice').getByText('Supprimé définitivement.').waitFor({ timeout: 10000 });
});

check('FAQ: create, reorder, hide and delete', async () => {
  await go(page, `${BASE}/admin/support/knowledge-base`);
  await page.getByTestId('kb-articles').waitFor({ timeout: 30000 });
  await page.locator('[data-tab="faqs"]').click();
  await page.getByTestId('kb-faqs').waitFor();
  assert.ok((await page.locator('[data-testid="kb-faqs"] > li').count()) >= 17);
  await page.getByTestId('new-faq').click();
  const question = `Question de test ${run} ?`;
  await page.getByTestId('faq-question').fill(question);
  await page.getByTestId('faq-answer').fill('Une réponse de test suffisamment longue.');
  await page.getByTestId('faq-save').click();
  await page.getByTestId('kb-notice').getByText('Question créée.').waitFor({ timeout: 10000 });
  const item = page.locator('[data-testid="kb-faqs"] > li', { hasText: question });
  await item.waitFor();
  await item.locator('[data-action="publish"]').click();
  await page.getByTestId('kb-notice').getByText('Question publiée.').waitFor({ timeout: 10000 });
  const before = await page.locator('[data-testid="kb-faqs"] > li').evaluateAll((rows) => rows.map((row) => row.getAttribute('data-faq')));
  await page.locator('[data-testid="kb-faqs"] > li').last().locator('[data-action="up"]').click();
  await page.getByTestId('kb-notice').getByText('Ordre enregistré.').waitFor({ timeout: 10000 });
  const after = await page.locator('[data-testid="kb-faqs"] > li').evaluateAll((rows) => rows.map((row) => row.getAttribute('data-faq')));
  assert.equal(after[after.length - 2], before[before.length - 1], 'the last question moved up');
  await page.locator('[data-testid="kb-faqs"] > li', { hasText: question }).locator('[data-action="delete"]').click();
  await page.getByTestId('kb-confirm-yes').click();
  await page.getByTestId('kb-notice').getByText('Supprimé définitivement.').waitFor({ timeout: 10000 });
});

check('analytics: real counts for the period and honest unavailable states', async () => {
  await go(page, `${BASE}/admin/support/analytics`);
  await page.getByTestId('analytics').waitFor({ timeout: 30000 });
  assert.ok(Number(await page.locator('[data-kpi="Demandes reçues"]').innerText()) >= 2);
  await page.getByTestId('column-chart').waitFor();
  await page.getByLabel('Regroupement').selectOption('week');
  await page.getByTestId('column-chart').waitFor();
  await page.locator('[data-kpi="Délai de résolution"]').getByText('—').waitFor();
  await page.getByText(/Indisponible : aucune résolution/).waitFor();
});

check('settings: read-only team, categories synced with the public form, availability only when enabled, audit log', async () => {
  await go(page, `${BASE}/admin/support/settings`);
  await page.getByTestId('staff-list').waitFor({ timeout: 30000 });
  await page.getByTestId('staff-list').getByText(/Testeur admin/).waitFor();
  assert.equal(await page.getByTestId('staff-list').getByRole('button').count(), 0, 'no way to grant admin from the UI');
  const id = `test-${run}`.slice(0, 20);
  await page.getByTestId('category-id').fill(id);
  await page.getByTestId('category-label').fill(`Rubrique ${run}`);
  await page.getByTestId('category-add').click();
  await page.getByTestId('settings-notice').getByText('Catégorie ajoutée.').waitFor({ timeout: 10000 });
  const publicCategories = await (await page.request.get(`${BASE}/api/support/categories`)).json();
  assert.ok(publicCategories.categories.some((category) => category.id === id), 'the public form offers the new category');
  await page.locator(`[data-category="${id}"] [data-action="toggle"]`).click();
  await page.getByTestId('settings-notice').getByText('Catégorie désactivée.').waitFor({ timeout: 10000 });
  const afterDisable = await (await page.request.get(`${BASE}/api/support/categories`)).json();
  assert.ok(!afterDisable.categories.some((category) => category.id === id), 'a disabled category is not offered');

  const help = await (await page.request.get(`${BASE}/help`)).text();
  assert.ok(!help.includes('SUPPORT-DISPO'), 'nothing shown before it is enabled');
  await page.getByTestId('availability-text').fill('SUPPORT-DISPO : réponse sous quelques jours ouvrés.');
  await page.getByTestId('availability-enabled').check();
  await page.getByTestId('availability-save').click();
  await page.getByTestId('settings-notice').getByText('Texte de disponibilité publié.').waitFor({ timeout: 10000 });
  await page.getByTestId('availability-enabled').uncheck();
  await page.getByTestId('availability-save').click();
  await page.getByTestId('settings-notice').getByText('Texte de disponibilité masqué.').waitFor({ timeout: 10000 });

  await go(page, `${BASE}/admin/support/audit`);
  await page.getByTestId('audit-list').waitFor({ timeout: 30000 });
  for (const label of ['Réponse envoyée', 'Priorité modifiée']) await page.getByTestId('audit-list').getByText(label).first().waitFor();
  const text = await page.getByTestId('audit-list').innerText();
  assert.ok(!text.includes('SECRET-INTERNE') && !/password|token/i.test(text), 'no message content or secret in the audit log');
  await page.getByTestId('audit-filter').selectOption('kb.');
  await page.getByTestId('audit-list').getByText(/Article|Question/).first().waitFor();
});

check('responsive: no horizontal scroll on any admin page at 1440, 768, 375 and 320; the drawer opens and closes with the keyboard', async () => {
  const id = await ticketId(memberRef);
  const paths = ['/admin/support', '/admin/support/tickets', `/admin/support/tickets/${id}`, '/admin/support/notifications', '/admin/support/knowledge-base', '/admin/support/analytics', '/admin/support/settings', '/admin/support/audit', '/admin/announcements'];
  for (const [width, height] of [[1440, 900], [768, 900], [375, 700], [320, 640]]) {
    await page.setViewportSize({ width, height });
    for (const path of paths) {
      await go(page, `${BASE}${path}`);
      await page.locator('main h1').first().waitFor({ timeout: 30000 });
      await page.waitForTimeout(400);
      await noOverflow(page, `${path} @${width}`);
    }
  }
  await page.setViewportSize({ width: 375, height: 700 });
  await go(page, `${BASE}/admin/support/tickets`);
  const button = page.getByTestId('admin-menu-button');
  await button.waitFor({ timeout: 30000 });
  await button.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Menu d’administration' });
  await dialog.waitFor();
  await dialog.getByRole('link', { name: /Statistiques/ }).waitFor();
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-testid')), 'admin-menu-button', 'focus returns to the menu button');
  await page.setViewportSize({ width: 1440, height: 900 });
});

check('the member support pages fit 320px and 375px phones', async () => {
  const id = await ticketId(memberRef);
  for (const width of [375, 320]) {
    await member.page.setViewportSize({ width, height: 700 });
    for (const path of ['/account/support', `/account/support/${id}`]) {
      await go(member.page, `${BASE}${path}`);
      await member.page.locator('main h1').first().waitFor({ timeout: 30000 });
      await member.page.waitForTimeout(400);
      await noOverflow(member.page, `${path} @${width}`);
    }
  }
  await member.page.setViewportSize({ width: 1440, height: 900 });
});

check('keyboard and reduced motion: a ticket can be reached and handled without a mouse; no animation under reduced motion', async () => {
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
  const reduced = await context.newPage();
  await login(reduced, admin.email);
  await go(reduced, `${BASE}/admin/support/tickets`);
  await reduced.getByTestId('ticket-table').waitFor({ timeout: 30000 });
  const link = reduced.locator(`[data-ticket="${memberRef}"] a`).first();
  await link.focus();
  await reduced.keyboard.press('Enter');
  await reduced.getByTestId('ticket-reference').waitFor({ timeout: 20000 });
  await reduced.getByLabel('Statut', { exact: true }).focus();
  await reduced.keyboard.press('ArrowDown');
  await reduced.getByTestId('ticket-notice').waitFor({ timeout: 10000 });
  const animated = await reduced.evaluate(() => [...document.querySelectorAll('*')].filter((element) => { const style = getComputedStyle(element); return style.animationName !== 'none' && style.animationDuration !== '0s' && !element.closest('[aria-busy]') && !element.matches('.animate-spin'); }).length);
  assert.equal(animated, 0, 'no running animation under prefers-reduced-motion');
  await context.close();
});

check('clean up: the test tickets are deleted by an administrator', async () => {
  for (const reference of [memberRef, guestRef]) {
    const id = await ticketId(reference);
    assert.equal((await page.request.delete(`${BASE}/api/admin/support/tickets/${id}`)).status(), 200);
  }
});

let failed = 0;
for (const { name, fn } of results) {
  try { await fn(); console.log(`PASS  ${name}`); }
  catch (error) { failed++; console.log(`FAIL  ${name}\n      ${String(error.message).split('\n').slice(0, 4).join(' | ').slice(0, 600)}`); }
}
await browser.close();
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
