/* global document, window */
// Browser tests for what opening the site does in each authentication state (real Chromium).
//
//   npm i -D playwright && npx playwright install chromium     (not a project dependency)
//   E2E_BASE_URL=http://localhost:4101 [E2E_DB_STOP_COMMAND="bash db-stop.sh" E2E_DB_START_COMMAND="bash db-start.sh"] node tests/browser/auth-flow.mjs
//
// Point it at a production server backed by an ISOLATED test database: it registers accounts and profiles. The two optional
// commands stop and start the isolated database (not the app) to prove the outage screen; that check is skipped without them.
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { chromium } from 'playwright';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4101';
const STOP = process.env.E2E_DB_STOP_COMMAND;
const START = process.env.E2E_DB_START_COMMAND;
const PASSWORD = 'Browser-Test-Pass-9x';
const PIN = '7392';
const WRONG = '1111';
const run = Date.now();
const results = [];
const check = (name, fn, options = {}) => results.push({ name, fn, skip: options.skip });

const browser = await chromium.launch();

const register = async (label) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const email = `authflow-${label}-${run}-${Math.round(Math.random() * 1e6)}@example.com`;
  await page.goto(`${BASE}/login`);
  await page.getByRole('button', { name: 'Inscription' }).click();
  await page.getByLabel('Nom').fill(`Auth ${label}`);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.locator('form input').nth(2).fill(PASSWORD);
  await page.getByRole('button', { name: 'Créer le compte' }).click();
  await page.waitForURL(/\/profiles/, { timeout: 20000 });
  return { context, page, email };
};
const addProfiles = async (page, names) => {
  for (const name of names) assert.equal((await page.request.post(`${BASE}/api/profiles`, { data: { name, avatar: 'ember', isKids: false, maturityLevel: 18, preferences: [], language: 'fr-FR', pin: PIN, confirmPin: PIN } })).status(), 201);
};
const profileNames = async (page) => (await (await page.request.get(`${BASE}/api/profiles`)).json()).profiles.map((profile) => profile.name);
const unlock = async (page, name, pin) => {
  await page.goto(`${BASE}/profiles`);
  await page.getByRole('button', { name: `Continuer avec ${name}` }).click();
  await page.waitForURL(/\/unlock$/, { timeout: 20000 });
  await page.locator('#profile-pin').waitFor({ state: 'attached' });
  await page.keyboard.type(pin, { delay: 40 });
};
const home = async (page) => {
  await page.waitForURL(`${BASE}/`, { timeout: 40000 });
  await page.waitForFunction(() => !document.querySelector('[data-cinematic-transition]'), null, { timeout: 30000 });
};

check('1. opening "/" signed out goes to the login screen: no profile screen, no empty list', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${BASE}/`);
  await page.waitForURL(/\/login/, { timeout: 20000 });
  await page.getByRole('button', { name: 'Inscription' }).waitFor();
  assert.equal(await page.getByText('Qui regarde').count(), 0);
  assert.equal(await page.getByText('Aucun profil pour le moment').count(), 0);
  for (const path of ['/profiles', '/my-list', '/account']) { await page.goto(`${BASE}${path}`); await page.waitForURL(/\/login/, { timeout: 20000 }); }
  await context.close();
});

check('2. signed in, no unlocked profile: "/" ends on the profile screen showing the existing profiles', async () => {
  const { context, page } = await register('locked');
  await addProfiles(page, ['Manel', 'Anas']);
  await page.goto(`${BASE}/`);
  await page.waitForURL(/\/profiles$/, { timeout: 30000 });
  await page.getByRole('button', { name: 'Continuer avec Manel' }).waitFor();
  await page.getByRole('button', { name: 'Continuer avec Anas' }).waitFor();
  await page.getByText('Synchronisé').waitFor();
  assert.equal(await page.getByText('Aucun profil pour le moment').count(), 0);
  assert.equal(await page.getByTestId('profiles-load-error').count(), 0);
  await context.close();
});

check('3. /login with a valid session does not ask to log in again: it continues to the profile screen', async () => {
  const { context, page } = await register('relogin');
  await addProfiles(page, ['Manel']);
  await page.goto(`${BASE}/login`);
  await page.waitForURL(/\/profiles$/, { timeout: 30000 });
  await page.getByRole('button', { name: 'Continuer avec Manel' }).waitFor();
  await context.close();
});

check('4. a wrong PIN is refused; the right PIN plays the loading and opens the homepage; "/" and "/login" then stay in the app', async () => {
  const { context, page } = await register('pin');
  await addProfiles(page, ['Manel', 'Anas']);
  await unlock(page, 'Manel', WRONG);
  await page.getByRole('alert').first().waitFor({ timeout: 15000 });
  assert.match(page.url(), /\/unlock$/, 'still on the PIN screen');
  assert.equal((await (await page.request.get(`${BASE}/api/profiles`)).json()).selectedProfileId, null, 'nothing unlocked');
  await page.goto(`${BASE}/`);
  await page.waitForURL(/\/profiles$/, { timeout: 30000 });
  await unlock(page, 'Manel', PIN);
  await home(page);
  await page.goto(`${BASE}/`);
  await page.locator('main').first().waitFor({ timeout: 30000 });
  assert.equal(new URL(page.url()).pathname, '/', 'an unlocked profile goes straight to the homepage');
  await page.goto(`${BASE}/login`);
  await page.waitForURL(`${BASE}/`, { timeout: 30000 });
  assert.equal(await page.getByText('Qui regarde').count(), 0);
  await context.close();
});

check('5. an expired session (signed out elsewhere) goes to the login with a clear message, and the profiles are untouched', async () => {
  const { context, page, email } = await register('expired');
  await addProfiles(page, ['Manel', 'Anas']);
  const other = await browser.newContext();
  await other.addCookies(await context.cookies());
  const csrf = await (await other.request.get(`${BASE}/api/auth/csrf`)).json();
  await other.request.post(`${BASE}/api/auth/signout`, { form: { csrfToken: csrf.csrfToken, json: 'true' } });
  await other.close();
  await page.goto(`${BASE}/`);
  await page.waitForURL(/\/login\?.*reason=expired/, { timeout: 30000 });
  await page.getByText(/Votre session a expiré/).waitFor();
  assert.equal(await page.getByText('Aucun profil pour le moment').count(), 0);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.locator('form input[type="password"]').first().fill(PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL(/\/profiles/, { timeout: 30000 });
  assert.deepEqual(await profileNames(page), ['Manel', 'Anas']);
  await context.close();
});

check('6. the screen says so when the profiles cannot be loaded (503): error + retry, no empty list, no "create a profile", still signed in', async () => {
  const { context, page } = await register('mock');
  await addProfiles(page, ['Manel', 'Anas']);
  let down = true;
  await page.route('**/api/profiles', (route) => (down && route.request().method() === 'GET' ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'La base de données est momentanément inaccessible. Vos profils ne sont pas supprimés.', code: 'DATABASE_UNAVAILABLE' }) }) : route.continue()));
  await page.goto(`${BASE}/profiles`);
  const error = page.getByTestId('profiles-load-error');
  await error.waitFor({ timeout: 30000 });
  await error.getByText(/ne sont pas supprimés/).first().waitFor();
  assert.equal(await page.getByText('Aucun profil pour le moment').count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Créer un profil' }).count(), 0, 'no invitation to recreate profiles');
  assert.match(new URL(page.url()).pathname, /^\/profiles$/, 'not sent to the login');
  await page.getByText('Base indisponible').waitFor();
  down = false;
  await page.getByTestId('profiles-retry').click();
  await page.getByRole('button', { name: 'Continuer avec Manel' }).waitFor({ timeout: 20000 });
  assert.equal(await page.getByTestId('profiles-load-error').count(), 0);
  await page.getByText('Synchronisé').waitFor();
  await context.close();
});

check('7. with the real database stopped: error screen on "/" and "/profiles" (the session is kept), then the same profiles and session after it returns', async () => {
  const { context, page } = await register('outage');
  await addProfiles(page, ['Manel', 'Anas']);
  const cookiesBefore = (await context.cookies()).map((cookie) => cookie.name).sort();
  execSync(STOP, { stdio: 'ignore' });
  try {
    await page.goto(`${BASE}/profiles`);
    await page.getByTestId('profiles-load-error').waitFor({ timeout: 40000 });
    assert.equal(await page.getByText('Aucun profil pour le moment').count(), 0);
    assert.equal(new URL(page.url()).pathname, '/profiles');
    await page.getByTestId('profiles-retry').click();
    await page.getByTestId('profiles-load-error').waitFor({ timeout: 30000 }); // still down: still an error
    await page.goto(`${BASE}/`);
    await page.getByTestId('profiles-load-error').waitFor({ timeout: 40000 });
    assert.equal(new URL(page.url()).pathname, '/', 'the homepage route shows the error instead of redirecting away');
  } finally {
    execSync(START, { stdio: 'ignore' });
  }
  assert.deepEqual((await context.cookies()).map((cookie) => cookie.name).sort(), cookiesBefore, 'the session cookies are untouched');
  await page.goto(`${BASE}/profiles`);
  await page.getByRole('button', { name: 'Continuer avec Manel' }).waitFor({ timeout: 40000 });
  await page.getByRole('button', { name: 'Continuer avec Anas' }).waitFor();
  assert.deepEqual(await profileNames(page), ['Manel', 'Anas']);
  await context.close();
}, { skip: !STOP || !START });

let failed = 0;
let skipped = 0;
for (const { name, fn, skip } of results) {
  if (skip) { skipped++; console.log(`SKIP  ${name}`); continue; }
  try { await fn(); console.log(`PASS  ${name}`); }
  catch (error) { failed++; console.log(`FAIL  ${name}\n      ${String(error.message).split('\n').slice(0, 4).join(' | ').slice(0, 600)}`); }
}
await browser.close();
console.log(`\n${results.length - failed - skipped}/${results.length - skipped} passed${skipped ? ` (${skipped} skipped)` : ''}`);
process.exit(failed ? 1 : 0);
