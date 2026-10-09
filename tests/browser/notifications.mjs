/* global document, window, MutationObserver, getComputedStyle */
// Browser tests for the notification center (real Chromium).
//
//   npm i -D playwright && npx playwright install chromium     (not a project dependency)
//   E2E_BASE_URL=http://localhost:4101 [E2E_GRANT_ADMIN_COMMAND="bash grant-admin.sh"] node tests/browser/notifications.mjs
//
// Point it at a production server backed by an ISOLATED test database: it registers accounts and creates notifications.
// E2E_GRANT_ADMIN_COMMAND (see tests/notifications.integration.test.ts) is needed for the announcement check only.
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { chromium } from 'playwright';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4101';
const GRANT = process.env.E2E_GRANT_ADMIN_COMMAND;
const PASSWORD = 'Browser-Test-Pass-9x';
const NEW_PASSWORD = 'Another-Strong-Pass-42';
const PIN = '7392';
const run = Date.now();
const results = [];
const check = (name, fn, options = {}) => results.push({ name, fn, skip: options.skip });

const register = async (browser, { viewport = { width: 1440, height: 900 }, reducedMotion = false, profile = false } = {}) => {
  const context = await browser.newContext({ viewport, reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message.slice(0, 160)));
  const email = `notif-ui-${run}-${Math.round(Math.random() * 1e6)}@example.com`;
  await page.goto(`${BASE}/login`);
  await page.getByRole('button', { name: 'Inscription' }).click();
  await page.getByLabel('Nom').fill('Notif Tester');
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
  return { context, page, email, errors };
};

// A real event: changing the password creates a security notification for the account.
const makeUnread = async (page, current = PASSWORD, next = NEW_PASSWORD) => {
  const res = await page.request.post(`${BASE}/api/account/password`, { data: { currentPassword: current, newPassword: next, confirmPassword: next } });
  assert.equal(res.status(), 200);
};
const openAccount = async (page) => { await page.goto(`${BASE}/account`); await page.locator('[data-section="overview"]').waitFor({ timeout: 20000 }); };
const bell = (page) => page.getByTestId('notification-bell');
const panel = (page) => page.getByTestId('notification-panel');
const badge = (page) => page.getByTestId('notification-badge');

check('no badge without unread notifications; the panel shows the empty state and closes with Escape and outside click', async () => {
  const { context, page, errors } = await register(browser);
  await openAccount(page);
  await bell(page).waitFor();
  assert.equal(await badge(page).count(), 0, 'no red badge');
  assert.equal(await bell(page).getAttribute('aria-label'), 'Notifications');
  assert.equal(await bell(page).getAttribute('aria-expanded'), 'false');
  await bell(page).click();
  await panel(page).waitFor();
  assert.equal(await bell(page).getAttribute('aria-expanded'), 'true');
  assert.equal(await panel(page).getAttribute('role'), 'dialog');
  assert.equal(await bell(page).getAttribute('aria-controls'), await panel(page).getAttribute('id'));
  assert.equal((await page.getByTestId('notification-empty').textContent()).trim(), 'Aucune notification pour le moment.');
  // the page behind must not show through: an unknown Tailwind opacity step would silently make this transparent
  const alpha = await panel(page).evaluate((el) => { const m = getComputedStyle(el).backgroundColor.match(/rgba?(([^)]+))/); const parts = m[1].split(',').map((x) => parseFloat(x)); return parts.length > 3 ? parts[3] : 1; });
  assert.equal(alpha, 1, `the panel background is fully opaque (alpha ${alpha})`);
  await page.getByRole('tab', { name: 'Non lues' }).click();
  await page.getByTestId('notification-empty').waitFor();
  await page.keyboard.press('Escape');
  await panel(page).waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-testid')), 'notification-bell', 'focus returns to the bell');
  await bell(page).click();
  await panel(page).waitFor();
  await page.locator('h1').first().click({ position: { x: 5, y: 5 } }); // outside
  await panel(page).waitFor({ state: 'detached' });
  assert.deepEqual(errors, []);
  await context.close();
});

check('a real event raises the badge; read and unread states, filters, "tout marquer comme lu" and the destination all work', async () => {
  const { context, page } = await register(browser);
  await makeUnread(page);
  await openAccount(page);
  await badge(page).waitFor();
  assert.equal((await badge(page).textContent()).trim(), '1');
  assert.match(await bell(page).getAttribute('aria-label'), /1 non lue/);
  await bell(page).click();
  const item = page.locator('[data-notification]').first();
  await item.waitFor();
  assert.equal(await item.getAttribute('data-unread'), 'true');
  await item.getByText('Mot de passe modifié').waitFor();
  await item.getByText(/Sécurité/).waitFor();
  await item.locator('time').waitFor();
  assert.match(await item.locator('time').textContent(), /instant|minute/, 'a relative French time');
  assert.equal(await item.innerText().then((text) => text.includes(PASSWORD) || text.includes(NEW_PASSWORD)), false, 'no secret on screen');
  await page.getByRole('tab', { name: /Non lues/ }).click();
  await page.locator('[data-notification]').first().waitFor();
  // individual read, then unread again
  await page.getByRole('button', { name: /Marquer comme lue : Mot de passe modifié/ }).click();
  await badge(page).waitFor({ state: 'detached' });
  await page.getByTestId('notification-empty').waitFor();
  await page.getByRole('tab', { name: 'Toutes' }).click();
  await page.locator('[data-notification][data-unread="false"]').waitFor();
  await page.getByRole('button', { name: /Marquer comme non lue : Mot de passe modifié/ }).click();
  await badge(page).waitFor();
  // mark everything
  await page.getByRole('button', { name: 'Tout marquer comme lu' }).click();
  await badge(page).waitFor({ state: 'detached' });
  assert.equal(await page.getByRole('button', { name: 'Tout marquer comme lu' }).isDisabled(), true);
  // the badge reflects the database after a reload
  await page.reload();
  await bell(page).waitFor();
  assert.equal(await badge(page).count(), 0);
  // following a notification goes to its page and keeps it read
  await bell(page).click();
  await page.locator('[data-notification]').first().getByRole('button', { name: /Mot de passe modifié/ }).first().click();
  await page.waitForURL(/\/help\/proteger-son-compte$/, { timeout: 15000 });
  await context.close();
});

check('keyboard and screen readers: the bell opens with Enter, focus moves into the panel, arrows change the tab, Escape returns focus', async () => {
  const { context, page } = await register(browser);
  await makeUnread(page);
  await openAccount(page);
  await bell(page).focus();
  await page.keyboard.press('Enter');
  await panel(page).waitFor();
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('role')), 'tab', 'focus is inside the panel');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-filter')), 'all');
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.getByRole('tab', { name: /Non lues/ }).getAttribute('aria-selected'), 'true');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-filter')), 'unread');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.getByRole('tab', { name: 'Toutes' }).getAttribute('aria-selected'), 'true');
  assert.ok(await page.getByRole('tablist', { name: 'Filtrer les notifications' }).count());
  for (const control of await page.locator('[data-testid="notification-panel"] button').all()) assert.ok((await control.getAttribute('aria-label')) || (await control.innerText()).trim(), 'every control has an accessible name');
  await page.keyboard.press('Escape');
  await panel(page).waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-testid')), 'notification-bell');
  await context.close();
});

check('loading failures are explained and can be retried', async () => {
  const { context, page } = await register(browser);
  await openAccount(page);
  await page.route('**/api/notifications?**', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"x"}' }));
  await bell(page).click();
  await page.getByTestId('notification-error').getByText('Impossible de charger vos notifications.').waitFor();
  await page.unroute('**/api/notifications?**');
  await page.getByRole('button', { name: 'Réessayer' }).click();
  await page.getByTestId('notification-empty').waitFor();
  await page.route('**/api/notifications?**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{"code":"NOTIFICATIONS_UNAVAILABLE"}' }));
  await page.getByRole('tab', { name: 'Non lues' }).click();
  await page.getByTestId('notification-error').getByText(/pas encore activées/).waitFor();
  await context.close();
});

for (const [name, viewport] of [['320', { width: 320, height: 640 }], ['375', { width: 375, height: 812 }], ['768', { width: 768, height: 1024 }], ['1440', { width: 1440, height: 900 }]]) {
  check(`[${name}px] the panel stays inside the screen with no horizontal overflow`, async () => {
    const { context, page } = await register(browser, { viewport });
    await makeUnread(page);
    await openAccount(page);
    await bell(page).click();
    await page.locator('[data-notification]').first().waitFor();
    const box = await panel(page).boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= viewport.width + 0.5, `horizontally inside (${Math.round(box.x)}..${Math.round(box.x + box.width)} of ${viewport.width})`);
    assert.ok(box.y >= 0 && box.y + box.height <= viewport.height + 0.5, 'vertically inside');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 0, `no horizontal overflow (${overflow}px)`);
    assert.ok(box.width >= Math.min(280, viewport.width - 24), 'wide enough to read');
    await context.close();
  });
}

check('no background polling: the unread count is read once per page load and reused when navigating', async () => {
  const { context, page } = await register(browser);
  await makeUnread(page);
  let countRequests = 0;
  page.on('request', (request) => { if (request.url().includes('/api/notifications/unread-count')) countRequests++; });
  await openAccount(page);
  await badge(page).waitFor();
  await page.waitForTimeout(6000);
  assert.equal(countRequests, 1, 'one read, no timer');
  await page.locator('footer').getByRole('link', { name: 'FAQ' }).click(); // client-side navigation to another page with a bell
  await page.waitForURL(/\/help/);
  await bell(page).waitFor();
  await page.waitForTimeout(1500);
  assert.equal(countRequests, 1, 'the count was reused, not fetched again');
  assert.equal(await badge(page).count(), 1);
  await context.close();
});

check('opening the bell never starts the cinematic loader, asks for a PIN or changes the selected profile', async () => {
  const { context, page } = await register(browser, { profile: true });
  await makeUnread(page);
  await page.goto(`${BASE}/`);
  await page.getByText('Recommandé pour Alex').first().waitFor({ timeout: 30000 });
  await page.waitForFunction(() => !document.querySelector('[data-cinematic-transition]'));
  const before = (await (await page.request.get(`${BASE}/api/profiles`)).json()).selectedProfileId;
  assert.ok(before);
  await page.evaluate(() => { window.__overlays = 0; new MutationObserver(() => { if (document.querySelector('[data-cinematic-transition]')) window.__overlays++; }).observe(document, { childList: true, subtree: true }); });
  await bell(page).waitFor();
  await badge(page).waitFor();
  await bell(page).click();
  await page.locator('[data-notification]').first().getByRole('button', { name: /Mot de passe modifié/ }).first().click();
  await page.waitForURL(/\/help\//, { timeout: 15000 });
  assert.equal(await page.evaluate(() => window.__overlays), 0, 'no loader');
  assert.equal(await page.locator('#profile-pin').count(), 0, 'no PIN screen');
  assert.equal((await (await page.request.get(`${BASE}/api/profiles`)).json()).selectedProfileId, before, 'the profile is unchanged');
  await context.close();
});

check('reduced motion: the panel opens without any animation', async () => {
  const { context, page } = await register(browser, { reducedMotion: true });
  await openAccount(page);
  await bell(page).click();
  await panel(page).waitFor();
  assert.equal(await panel(page).evaluate((el) => getComputedStyle(el).animationName), 'none');
  await context.close();
});

check('account preferences are real: they persist, cover only the optional categories, and say what is always on', async () => {
  const { context, page } = await register(browser);
  await openAccount(page);
  const prefs = page.locator('[data-section="preferences"]');
  await prefs.getByRole('switch').first().waitFor();
  assert.equal(await prefs.getByRole('switch').count(), 2, 'only two optional switches');
  const catalogue = prefs.getByRole('switch', { name: 'Nouveautés du catalogue' });
  assert.equal(await catalogue.getAttribute('aria-checked'), 'true');
  await catalogue.click();
  await prefs.getByText('Préférence enregistrée.').waitFor({ timeout: 10000 });
  assert.equal(await catalogue.getAttribute('aria-checked'), 'false');
  await prefs.getByText(/toujours activés/).waitFor();
  assert.ok((await prefs.innerText()).includes('sécurité'), 'security is listed as always on');
  await page.reload();
  const again = page.locator('[data-section="preferences"]').getByRole('switch', { name: 'Nouveautés du catalogue' });
  await again.waitFor();
  assert.equal(await again.getAttribute('aria-checked'), 'false', 'persisted in the database');
  assert.equal(await page.locator('[data-section="preferences"]').getByRole('switch', { name: 'Actualités du service' }).getAttribute('aria-checked'), 'true');
  await context.close();
});

check('staff announce from the admin page; the bell of an opted-in member shows it and withdrawing removes it', async () => {
  const title = `Annonce navigateur ${run}`;
  const { context: memberContext, page: memberPage } = await register(browser);
  await memberPage.goto(`${BASE}/admin/announcements`);
  await memberPage.getByRole('heading', { name: 'Page Not Found' }).waitFor({ timeout: 20000 });
  await memberContext.close();

  const watcher = await register(browser);
  const { context, page, email } = await register(browser);
  execSync(GRANT, { env: { ...process.env, ADMIN_EMAIL: email }, stdio: 'ignore' }); // restarts the isolated stack
  await page.goto(`${BASE}/login`);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.locator('form input[type="password"]').first().fill(PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL(/\/profiles/, { timeout: 30000 });
  await watcher.page.goto(`${BASE}/login`);
  await watcher.page.getByLabel('Email', { exact: true }).fill(watcher.email);
  await watcher.page.locator('form input[type="password"]').first().fill(PASSWORD);
  await watcher.page.getByRole('button', { name: 'Se connecter' }).click();
  await watcher.page.waitForURL(/\/profiles/, { timeout: 30000 });

  await page.goto(`${BASE}/admin/announcements`);
  const form = page.getByTestId('announcement-form');
  await form.waitFor({ timeout: 20000 });
  await form.getByLabel('Titre').fill(title);
  await form.getByLabel('Message').fill('Trois nouveaux films viennent d’arriver au catalogue.');
  await form.getByLabel('Destination au clic').selectOption({ label: 'Catalogue' });
  await form.getByRole('button', { name: 'Envoyer…' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Confirmer l’envoi' }).click();
  await page.getByTestId('announcement-notice').getByText(/Annonce envoyée à \d+ compte/).waitFor({ timeout: 15000 });
  const card = page.locator('[data-announcement]').filter({ hasText: title });
  await card.waitFor();

  await openAccount(watcher.page);
  await badge(watcher.page).waitFor({ timeout: 15000 });
  await bell(watcher.page).click();
  await watcher.page.locator('[data-notification]').filter({ hasText: title }).waitFor();
  await watcher.page.locator('[data-notification]').filter({ hasText: title }).getByText(/Catalogue/).first().waitFor();

  await card.getByRole('button', { name: 'Retirer' }).click();
  await page.getByTestId('announcement-notice').getByText(/Annonce retirée/).waitFor({ timeout: 10000 });
  await watcher.page.reload();
  await bell(watcher.page).click();
  await watcher.page.getByTestId('notification-empty').waitFor({ timeout: 15000 });
  await context.close();
  await watcher.context.close();
}, { skip: !GRANT });

const browser = await chromium.launch();
let failed = 0;
let skipped = 0;
for (const { name, fn, skip } of results) {
  if (skip) { skipped++; console.log(`SKIP  ${name}`); continue; }
  try { await fn(); console.log(`PASS  ${name}`); }
  catch (error) { failed++; console.log(`FAIL  ${name}\n      ${String(error.message).split('\n').slice(0, 3).join(' | ').slice(0, 420)}`); }
}
await browser.close();
console.log(`\n${results.length - failed - skipped}/${results.length - skipped} passed${skipped ? ` (${skipped} skipped)` : ''}`);
process.exit(failed ? 1 : 0);
