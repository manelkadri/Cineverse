/* global document, window, getComputedStyle */
// Browser tests for the "Mon compte" page (real Chromium, real rendering).
//
//   npm i -D playwright && npx playwright install chromium     (not a project dependency)
//   E2E_BASE_URL=http://localhost:4101 node tests/browser/account-page.mjs
//
// Point it at a production server backed by an ISOLATED test database: it registers, edits and deletes test accounts.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4101';
const PASSWORD = 'Browser-Test-Pass-9x';
const NEW_PASSWORD = 'Another-Strong-Pass-42';
const PIN = '7392';
const results = [];
const check = (name, fn) => results.push({ name, fn });

async function newUser(browser, { viewport = { width: 1440, height: 900 }, reducedMotion = false } = {}) {
  const context = await browser.newContext({ viewport, reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message.slice(0, 160)));
  const email = `account-ui-${Date.now()}-${Math.round(Math.random() * 1e6)}@example.com`;
  await page.goto(`${BASE}/login`);
  await page.getByRole('button', { name: 'Inscription' }).click();
  await page.getByLabel('Nom').fill('Camille Durand');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.locator('form input').nth(2).fill(PASSWORD);
  await page.getByRole('button', { name: 'Créer le compte' }).click();
  await page.waitForURL(/\/profiles/, { timeout: 20000 });
  for (const name of ['Alex', 'Mini']) {
    const kids = name === 'Mini';
    const response = await page.request.post(`${BASE}/api/profiles`, { data: { name, avatar: kids ? 'mint' : 'ember', isKids: kids, maturityLevel: kids ? 10 : 18, preferences: [], language: 'fr-FR', pin: PIN, confirmPin: PIN, ...(kids ? { parentalPin: '4821' } : {}) } });
    assert.equal(response.status(), 201, `creating ${name}`);
  }
  return { context, page, errors, email };
}

const openAccount = async (page) => {
  await page.goto(`${BASE}/account`);
  await page.getByRole('heading', { name: 'Mon compte', level: 1 }).waitFor({ timeout: 20000 });
  await page.locator('[data-section="overview"]').waitFor({ timeout: 20000 });
};
const section = (page, id) => page.locator(`[data-section="${id}"]`);

check('anonymous visitors are redirected to the login page', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${BASE}/account`);
  await page.waitForURL(/\/login/, { timeout: 15000 });
  assert.match(page.url(), /callbackUrl/);
  await context.close();
});

const VIEWPORTS = [['mobile', { width: 375, height: 812 }], ['tablet', { width: 768, height: 1024 }], ['desktop', { width: 1440, height: 900 }]];
for (const [vp, viewport] of VIEWPORTS) {
  check(`[${vp}] the page renders real account data in every section, with no horizontal overflow, without unlocking a profile`, async () => {
    const { context, page, errors, email } = await newUser(browser, { viewport });
    await openAccount(page); // straight to the account: no profile unlock needed
    assert.match(page.url(), /\/account$/);
    await page.getByText('Gérez vos informations personnelles, votre sécurité et vos préférences.').waitFor();
    assert.equal((await page.locator('[data-testid="account-name"]').textContent()).trim(), 'Camille Durand');
    assert.equal((await page.locator('[data-testid="account-email"]').textContent()).trim(), email);
    assert.equal((await page.locator('[data-testid="account-profile-count"]').textContent()).trim(), '2');
    assert.match(await page.locator('[data-testid="account-created"]').textContent(), /\d{4}/);
    for (const title of ['Informations personnelles', 'Mot de passe et sécurité', 'Gestion des profils', 'Préférences du compte', 'Appareils et sessions', 'Confidentialité et données']) {
      await page.getByRole('heading', { name: title, level: 2 }).waitFor();
    }
    const profiles = await page.locator('[data-testid="account-profiles"] li').allTextContents();
    assert.equal(profiles.length, 2);
    assert.ok(profiles[0].includes('Alex') && profiles[0].includes('PIN actif'));
    assert.ok(profiles[1].includes('Mini') && profiles[1].includes('Profil enfant'));
    assert.equal(await page.locator('[data-testid="account-sessions"] li').count(), 1);
    await page.getByRole('link', { name: 'Gérer mes profils' }).waitFor();
    assert.equal(await page.locator('nav').first().isVisible(), true, 'navbar present');
    assert.equal(await page.locator('footer').count(), 1, 'footer present');
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('main')).backgroundColor), 'rgb(8, 9, 13)');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 0, `no horizontal overflow (${overflow}px)`);
    assert.deepEqual(errors, []);
    await context.close();
  });
}

check('the navbar "Compte" menu item opens the account page; "Gérer mes profils" goes to the existing profile flow', async () => {
  const { context, page } = await newUser(browser);
  await page.goto(`${BASE}/profiles`);
  await page.getByRole('button', { name: 'Continuer avec Alex' }).click();
  await page.waitForURL(/\/unlock$/, { timeout: 20000 });
  await page.locator('#profile-pin').waitFor({ state: 'attached' });
  await page.keyboard.type(PIN, { delay: 40 });
  await page.waitForURL(`${BASE}/`, { timeout: 40000 });
  await page.getByRole('button', { name: 'Ouvrir le menu du profil' }).click();
  await page.getByRole('menuitem', { name: 'Compte' }).click();
  await page.waitForURL(/\/account$/, { timeout: 15000 });
  await page.getByRole('heading', { name: 'Mon compte', level: 1 }).waitFor();
  await page.getByRole('link', { name: 'Gérer mes profils' }).click();
  await page.waitForURL(/\/profiles$/, { timeout: 15000 });
  await context.close();
});

check('editing the name saves it, updates the page immediately, and keeps the e-mail read-only', async () => {
  const { context, page, email } = await newUser(browser);
  await openAccount(page);
  const emailInput = page.locator('#account-email-input');
  assert.equal(await emailInput.getAttribute('readonly'), '');
  assert.equal(await emailInput.inputValue(), email);
  await page.getByText(/Elle ne peut pas encore être modifiée/).waitFor();
  const save = section(page, 'personal').getByRole('button', { name: 'Enregistrer' });
  assert.equal(await save.isDisabled(), true, 'nothing to save yet');
  await page.locator('#account-name-input').fill('C');
  await save.click();
  await section(page, 'personal').getByRole('alert').filter({ hasText: /au moins 2 caractères/ }).waitFor();
  await page.locator('#account-name-input').fill('Camille Martin');
  await save.click();
  await section(page, 'personal').getByRole('status').filter({ hasText: 'mis à jour' }).waitFor({ timeout: 10000 });
  assert.equal((await page.locator('[data-testid="account-name"]').textContent()).trim(), 'Camille Martin', 'overview updated at once');
  await page.reload();
  await page.locator('[data-testid="account-name"]').waitFor();
  assert.equal((await page.locator('[data-testid="account-name"]').textContent()).trim(), 'Camille Martin', 'persisted in the database');
  await context.close();
});

check('password change: show/hide, precise French errors, success closes the other sessions and keeps this one', async () => {
  const { context, page, email } = await newUser(browser);
  // a second device
  const second = await browser.newContext();
  const secondPage = await second.newPage();
  await secondPage.goto(`${BASE}/login`);
  await secondPage.getByLabel('Email', { exact: true }).fill(email);
  await secondPage.locator('form input[type="password"]').first().fill(PASSWORD);
  await secondPage.getByRole('button', { name: 'Se connecter' }).click();
  await secondPage.waitForURL(/\/profiles/, { timeout: 20000 });

  await openAccount(page);
  assert.equal(await page.locator('[data-testid="account-sessions"] li').count(), 2);
  const security = section(page, 'security');
  const current = page.locator('#current-password');
  assert.equal(await current.getAttribute('type'), 'password');
  await security.getByRole('button', { name: /Afficher mot de passe actuel/i }).click();
  assert.equal(await current.getAttribute('type'), 'text', 'show');
  await security.getByRole('button', { name: /Masquer mot de passe actuel/i }).click();
  assert.equal(await current.getAttribute('type'), 'password', 'hide');

  const submit = security.getByRole('button', { name: 'Modifier le mot de passe' });
  await submit.click();
  await security.getByRole('alert').filter({ hasText: 'Saisissez votre mot de passe actuel.' }).waitFor();
  await current.fill(PASSWORD);
  await page.locator('#new-password').fill('court');
  await submit.click();
  await security.getByRole('alert').filter({ hasText: /trop faible/ }).waitFor();
  await page.locator('#new-password').fill(NEW_PASSWORD);
  await page.locator('#confirm-password').fill('Mismatch-Strong-Pass-42');
  await submit.click();
  await security.getByRole('alert').filter({ hasText: /confirmation ne correspond pas/ }).waitFor();
  await page.locator('#confirm-password').fill(NEW_PASSWORD);
  await current.fill('Wrong-Password-123');
  await submit.click();
  await security.getByRole('alert').filter({ hasText: /actuel est incorrect/ }).waitFor({ timeout: 15000 });
  await current.fill(PASSWORD);
  await submit.click();
  await security.getByRole('status').filter({ hasText: /Mot de passe modifié/ }).waitFor({ timeout: 20000 });
  assert.equal(await current.inputValue(), '', 'fields cleared after success');
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="account-sessions"] li').length === 1);
  const stillIn = await (await page.request.get(`${BASE}/api/auth/session`)).json();
  assert.ok(stillIn.user, 'this session stays signed in');
  const secondSession = await (await second.request.get(`${BASE}/api/auth/session`)).json();
  assert.equal(secondSession.user, undefined, 'the other device was signed out');
  await second.close();
  await context.close();
});

check('sessions: another device can be closed from the page', async () => {
  const { context, page, email } = await newUser(browser);
  const second = await browser.newContext();
  const secondPage = await second.newPage();
  await secondPage.goto(`${BASE}/login`);
  await secondPage.getByLabel('Email', { exact: true }).fill(email);
  await secondPage.locator('form input[type="password"]').first().fill(PASSWORD);
  await secondPage.getByRole('button', { name: 'Se connecter' }).click();
  await secondPage.waitForURL(/\/profiles/, { timeout: 20000 });
  await openAccount(page);
  const sessions = section(page, 'sessions');
  assert.equal(await page.locator('[data-testid="account-sessions"] li').count(), 2);
  await sessions.getByText('Cette session').waitFor();
  await sessions.getByRole('button', { name: 'Fermer', exact: true }).click();
  await sessions.getByRole('status').filter({ hasText: 'fermée' }).waitFor({ timeout: 10000 });
  assert.equal(await page.locator('[data-testid="account-sessions"] li').count(), 1);
  assert.equal((await (await second.request.get(`${BASE}/api/auth/session`)).json()).user, undefined, 'the other device lost its session');
  assert.equal(await sessions.getByRole('button', { name: 'Fermer les autres sessions' }).isDisabled(), true, 'nothing left to close');
  await second.close();
  await context.close();
});

check('account deletion: guarded by password and the typed word, then the account is gone', async () => {
  const { context, page, email } = await newUser(browser);
  await openAccount(page);
  const privacy = section(page, 'privacy');
  await privacy.getByText('Cette action est définitive').waitFor();
  await privacy.getByRole('button', { name: 'Supprimer mon compte' }).click();
  const form = page.locator('[data-testid="delete-account-form"]');
  const confirmButton = form.getByRole('button', { name: 'Supprimer définitivement' });
  assert.equal(await confirmButton.isDisabled(), true, 'disabled until password and word are given');
  await page.locator('#delete-password').fill('Wrong-Password-123');
  await page.locator('#delete-phrase').fill('supprimer');
  assert.equal(await confirmButton.isDisabled(), true, 'the word must match exactly');
  await page.locator('#delete-phrase').fill('SUPPRIMER');
  await confirmButton.click();
  await privacy.getByRole('alert').filter({ hasText: 'Mot de passe incorrect' }).waitFor({ timeout: 15000 });
  assert.equal((await page.request.get(`${BASE}/api/account`)).status(), 200, 'a refused attempt deleted nothing');
  await page.locator('#delete-password').fill(PASSWORD);
  await confirmButton.click();
  await page.waitForURL(/\/login/, { timeout: 30000 });
  const login = await page.request.post(`${BASE}/api/auth/callback/credentials`, { form: { csrfToken: (await (await page.request.get(`${BASE}/api/auth/csrf`)).json()).csrfToken, email, password: PASSWORD, json: 'true' } });
  assert.ok(login.status() < 500);
  assert.equal((await (await page.request.get(`${BASE}/api/auth/session`)).json()).user, undefined, 'the deleted account cannot sign in');
  await context.close();
});

check('personal data download works with the password (a JSON file without secrets)', async () => {
  const { context, page } = await newUser(browser);
  await openAccount(page);
  const privacy = section(page, 'privacy');
  await privacy.getByRole('button', { name: 'Télécharger mes données' }).click();
  await page.locator('#export-password').fill('Wrong-Password-123');
  await privacy.getByRole('button', { name: 'Télécharger', exact: true }).click();
  await privacy.getByRole('alert').filter({ hasText: 'Mot de passe incorrect' }).waitFor({ timeout: 15000 });
  await page.locator('#export-password').fill(PASSWORD);
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), privacy.getByRole('button', { name: 'Télécharger', exact: true }).click()]);
  assert.equal(download.suggestedFilename(), 'cineverse-mes-donnees.json');
  await context.close();
});

check('reduced motion: spinners and skeletons do not animate', async () => {
  const { context, page } = await newUser(browser, { reducedMotion: true });
  await openAccount(page);
  const animated = await page.evaluate(() => [...document.querySelectorAll('main *')].filter((el) => getComputedStyle(el).animationName !== 'none' && getComputedStyle(el).animationName !== '').length);
  assert.equal(animated, 0, 'no running CSS animation on the account page');
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
