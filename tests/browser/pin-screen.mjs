/* global window, document, getComputedStyle */
// Browser tests for the profile PIN lock screen (real Chromium, real rendering).
//
//   npm i -D playwright && npx playwright install chromium     (not a project dependency)
//   E2E_BASE_URL=http://localhost:4101 node tests/browser/pin-screen.mjs
//
// Point it at a production server backed by an ISOLATED test database: it registers users and creates profiles.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4101';
const PASSWORD = 'Browser-Test-Pass-9x';
const PIN_A = '7392';
const PIN_B = '5038';
const OVERLAY = '[data-cinematic-transition]';
const results = [];
const check = (name, fn) => results.push({ name, fn });

async function newUser(browser, { viewport = { width: 1440, height: 900 }, reducedMotion = false, profiles = [['Alex', PIN_A], ['Sophie', PIN_B]] } = {}) {
  const context = await browser.newContext({ viewport, reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message.slice(0, 160)));
  const email = `pin-ui-${Date.now()}-${Math.round(Math.random() * 1e6)}@example.com`;
  await page.goto(`${BASE}/login`);
  await page.getByRole('button', { name: 'Inscription' }).click();
  await page.getByLabel('Nom').fill('Pin Tester');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.locator('form input').nth(2).fill(PASSWORD);
  await page.getByRole('button', { name: 'Créer le compte' }).click();
  await page.waitForURL(/\/profiles/, { timeout: 20000 });
  const ids = {};
  for (const [name, pin] of profiles) {
    const response = await page.request.post(`${BASE}/api/profiles`, { data: { name, avatar: 'ember', isKids: false, maturityLevel: 18, preferences: [], language: 'fr-FR', pin, confirmPin: pin } });
    assert.equal(response.status(), 201, `creating profile ${name}`);
    ids[name] = (await response.json()).profile.id;
  }
  await page.goto(`${BASE}/profiles`);
  await page.getByRole('heading', { name: /Qui regarde/ }).waitFor();
  return { context, page, errors, ids, email };
}

const openPin = async (page, name) => {
  await page.getByRole('button', { name: `Continuer avec ${name}` }).click();
  await page.waitForURL(/\/unlock$/, { timeout: 20000 });
  await page.locator('#profile-pin').waitFor({ state: 'attached' });
};
const dots = (page) => page.locator('[data-pin-dot]').count();
const overlay = (page) => page.locator(OVERLAY).count();
const focusedId = (page) => page.evaluate(() => document.activeElement?.id ?? null);
const countUnlocks = (page) => { const state = { n: 0 }; page.on('request', (request) => { if (request.method() === 'POST' && /\/api\/profiles\/[^/]+\/unlock$/.test(request.url())) state.n++; }); return state; };

const VIEWPORTS = [['mobile', { width: 375, height: 812 }], ['tablet', { width: 768, height: 1024 }], ['desktop', { width: 1440, height: 900 }]];

for (const [vp, viewport] of VIEWPORTS) {
  check(`[${vp}] layout: four equal horizontal square boxes over one masked numeric input, no keypad, no button, no overflow`, async () => {
    const { context, page, errors } = await newUser(browser, { viewport, profiles: [['Alex', PIN_A]] });
    await openPin(page, 'Alex');
    assert.equal(await overlay(page), 0, 'no cinematic loader on the PIN screen');
    const boxes = await page.locator('[data-pin-box]').evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }));
    assert.equal(boxes.length, 4, 'exactly four boxes');
    for (const box of boxes) {
      assert.ok(Math.abs(box.w - box.h) < 1.5, `square (${box.w}x${box.h})`);
      assert.ok(Math.abs(box.w - boxes[0].w) < 1.5, 'equal size');
      assert.ok(Math.abs(box.y - boxes[0].y) < 1.5, 'same row (horizontal)');
    }
    for (let i = 1; i < 4; i++) assert.ok(boxes[i].x > boxes[i - 1].x + boxes[i - 1].w - 1, 'left to right, no overlap');
    const input = page.locator('#profile-pin');
    assert.equal(await page.locator('input').count(), 1, 'a single real input');
    assert.equal(await input.getAttribute('type'), 'password');
    assert.equal(await input.getAttribute('inputmode'), 'numeric');
    assert.equal(await input.getAttribute('autocomplete'), 'off');
    assert.equal(await input.getAttribute('maxlength'), '4');
    assert.equal(await focusedId(page), 'profile-pin', 'autofocused');
    assert.equal(await page.locator('[data-testid="pin-card"] button').count(), 0, 'no keypad and no unlock button');
    assert.equal(await page.getByRole('heading', { name: 'Entrez votre code PIN' }).count(), 1);
    await page.getByText('Saisissez les 4 chiffres pour ouvrir ce profil.').waitFor();
    assert.equal((await page.locator('[data-testid="pin-profile-name"]').textContent()).trim(), 'Alex', 'name comes from the profile');
    await page.getByRole('link', { name: 'Retour aux profils' }).waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 0, `no horizontal overflow (${overflow}px)`);
    const card = await page.locator('[data-testid="pin-card"]').boundingBox();
    assert.ok(card.x >= 0 && card.x + card.width <= viewport.width, 'card inside the viewport');
    assert.deepEqual(errors, []);
    await context.close();
  });
}

check('typing shows red dots (never digits), Backspace removes one, paste keeps four digits, nothing is submitted before the 4th digit', async () => {
  const { context, page } = await newUser(browser, { profiles: [['Alex', PIN_A]] });
  const unlocks = countUnlocks(page);
  await openPin(page, 'Alex');
  await page.keyboard.type('73');
  assert.equal(await dots(page), 2);
  const boxText = await page.locator('[data-pin-box]').evaluateAll((els) => els.map((el) => el.textContent));
  assert.deepEqual(boxText, ['', '', '', ''], 'digits are never rendered as text');
  const dotColor = await page.locator('[data-pin-dot]').first().evaluate((el) => getComputedStyle(el).backgroundColor);
  assert.equal(dotColor, 'rgb(229, 9, 20)', 'dots are the brand red');
  await page.keyboard.press('Backspace');
  assert.equal(await dots(page), 1);
  await page.keyboard.type('7');
  await page.keyboard.type('x!'); // non-digits are ignored
  assert.equal(await dots(page), 2);
  await page.waitForTimeout(400);
  assert.equal(unlocks.n, 0, 'no request before 4 digits');
  await page.keyboard.press('Backspace'); await page.keyboard.press('Backspace');
  await page.locator('#profile-pin').evaluate((el) => {
    const data = new DataTransfer(); data.setData('text', '1 2-3 ');
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  });
  assert.equal(await dots(page), 3, 'pasted text is reduced to its digits');
  await page.waitForTimeout(300);
  assert.equal(unlocks.n, 0);
  await context.close();
});

check('auto-verifies exactly at the 4th digit (one request, no Enter, no button), then a pasted full code works too', async () => {
  const { context, page } = await newUser(browser, { profiles: [['Alex', PIN_A]] });
  const unlocks = countUnlocks(page);
  await openPin(page, 'Alex');
  await page.keyboard.type('739');
  await page.waitForTimeout(300);
  assert.equal(unlocks.n, 0);
  await page.keyboard.type('2');
  await page.waitForURL(`${BASE}/`, { timeout: 40000 });
  assert.equal(unlocks.n, 1, 'one single verification');
  await context.close();
});

check('wrong PIN: stays put, "Code PIN incorrect" with icon, shake, red boxes, digits cleared, focus restored, no loader, no hint about digits', async () => {
  const { context, page } = await newUser(browser, { profiles: [['Alex', PIN_A]] });
  await openPin(page, 'Alex');
  const shaken = page.waitForSelector('.cv-pin--shake', { state: 'attached', timeout: 10000 }); // the shake lasts under 500 ms: watch for it from the start
  await page.keyboard.type('1111');
  const alert = page.locator('#pin-problem');
  await alert.waitFor({ timeout: 10000 });
  assert.equal((await alert.textContent()).trim(), 'Code PIN incorrect');
  assert.equal(await alert.locator('svg').count(), 1, 'error icon');
  await shaken;
  assert.match(page.url(), /\/unlock$/);
  assert.equal(await dots(page), 0, 'digits cleared');
  await page.waitForFunction(() => document.activeElement?.id === 'profile-pin');
  // the border colour eases in (software-rendered CI frames can be slow), so poll for the final value
  await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-pin-box]')).borderTopColor === 'rgb(255, 45, 58)', null, { timeout: 5000 });
  assert.equal(await overlay(page), 0, 'the loader is never shown for a wrong code');
  assert.equal(/\d/.test(await alert.textContent()), false, 'no digit or attempt count in the message');
  await page.keyboard.type(PIN_A); // retry works without reloading
  await page.waitForURL(`${BASE}/`, { timeout: 40000 });
  await context.close();
});

check('network failure shows a separate French message, keeps the screen usable, and a retry succeeds', async () => {
  const { context, page } = await newUser(browser, { profiles: [['Alex', PIN_A]] });
  await openPin(page, 'Alex');
  await page.route('**/api/profiles/*/unlock', (route) => route.abort('failed'));
  await page.keyboard.type(PIN_A);
  const alert = page.locator('#pin-problem');
  await alert.waitFor({ timeout: 10000 });
  assert.match(await alert.textContent(), /Connexion impossible/);
  assert.doesNotMatch(await alert.textContent(), /incorrect/i, 'a network failure is not reported as a wrong PIN');
  assert.equal(await overlay(page), 0);
  await page.unroute('**/api/profiles/*/unlock');
  await page.waitForFunction(() => document.activeElement?.id === 'profile-pin');
  await page.keyboard.type(PIN_A);
  await page.waitForURL(`${BASE}/`, { timeout: 40000 });
  await context.close();
});

check('brute force: after five wrong codes the screen locks with a clear message and the right code no longer works', async () => {
  const { context, page } = await newUser(browser, { profiles: [['Alex', PIN_A]] });
  await openPin(page, 'Alex');
  for (let i = 0; i < 5; i++) {
    await page.keyboard.type('1111');
    await page.locator('#pin-problem').filter({ hasText: 'Code PIN incorrect' }).waitFor({ timeout: 10000 });
    await page.waitForFunction(() => document.activeElement?.id === 'profile-pin');
    await page.keyboard.type('x'); // dismisses nothing; keeps focus honest
  }
  await page.keyboard.type('1111');
  await page.locator('#pin-problem').filter({ hasText: /minute|seconde|Trop/i }).waitFor({ timeout: 10000 });
  assert.equal(await page.locator('#profile-pin').isDisabled(), true, 'input disabled during the lockout');
  assert.equal(await overlay(page), 0);
  const response = await page.request.post(`${BASE}/api/profiles/${new URL(page.url()).pathname.split('/')[2]}/unlock`, { data: { pin: PIN_A } });
  assert.equal(response.status(), 429, 'the correct code is refused during the lockout');
  await context.close();
});

check('correct PIN: the cinematic loader starts only after the server accepted the code, ends on the homepage of that profile', async () => {
  const { context, page, errors } = await newUser(browser, { profiles: [['Alex', PIN_A], ['Sophie', PIN_B]] });
  let responseAt = null;
  page.on('response', (response) => { if (/\/api\/profiles\/[^/]+\/unlock$/.test(response.url()) && response.status() === 200) responseAt = Date.now(); });
  await openPin(page, 'Alex');
  assert.equal(await overlay(page), 0, 'no loader while the code is being typed');
  // installed in the current document (the whole flow is client-side navigation, so it survives until the homepage)
  await page.evaluate(() => {
    window.__ov = { addedAt: null, goneAt: null };
    new MutationObserver(() => {
      const present = Boolean(document.querySelector('[data-cinematic-transition]'));
      if (present && !window.__ov.addedAt) window.__ov.addedAt = Date.now();
      if (!present && window.__ov.addedAt && !window.__ov.goneAt) window.__ov.goneAt = Date.now();
    }).observe(document, { childList: true, subtree: true });
  });
  await page.keyboard.type(PIN_A);
  await page.waitForURL(`${BASE}/`, { timeout: 40000 });
  await page.waitForFunction(() => window.__ov.goneAt !== null, null, { timeout: 40000 });
  await page.getByText('Recommandé pour Alex').first().waitFor({ timeout: 20000 });
  assert.ok(responseAt !== null, 'a 200 unlock response was seen');
  const ov = await page.evaluate(() => window.__ov);
  assert.ok(ov.addedAt !== null, 'the cinematic loader was shown');
  assert.ok(ov.addedAt >= responseAt - 5, 'loader appeared only after the successful response');
  assert.ok(ov.goneAt - ov.addedAt >= 600, `the loader really played (${ov.goneAt - ov.addedAt} ms)`);
  // normal navigation afterwards never replays it
  await page.goto(`${BASE}/my-list`);
  await page.waitForTimeout(800);
  assert.equal(await overlay(page), 0);
  assert.deepEqual(errors, []);
  await context.close();
});

check('switching profiles from the navbar requires the other profile’s PIN; the previous profile’s data is never shown for it', async () => {
  const { context, page, ids } = await newUser(browser, { profiles: [['Alex', PIN_A], ['Sophie', PIN_B]] });
  await openPin(page, 'Alex');
  await page.keyboard.type(PIN_A);
  await page.waitForURL(`${BASE}/`, { timeout: 40000 });
  await page.getByText('Recommandé pour Alex').first().waitFor({ timeout: 20000 });
  await page.getByRole('button', { name: /profil/i }).first().click();
  await page.getByRole('menuitem', { name: /Sophie/ }).click();
  await page.waitForURL(new RegExp(`/profiles/${ids.Sophie}/unlock$`), { timeout: 15000 });
  assert.equal((await page.locator('[data-testid="pin-profile-name"]').textContent()).trim(), 'Sophie');
  await page.keyboard.type(PIN_A); // Alex's code must not open Sophie
  await page.locator('#pin-problem').filter({ hasText: 'Code PIN incorrect' }).waitFor({ timeout: 10000 });
  await page.keyboard.type(PIN_B);
  await page.waitForURL(`${BASE}/`, { timeout: 40000 });
  await page.getByText('Recommandé pour Sophie').first().waitFor({ timeout: 20000 });
  assert.equal(await page.getByText('Recommandé pour Alex').count(), 0);
  await context.close();
});

check('Retour aux profils returns to the picker without unlocking anything; protected pages bounce back to the picker', async () => {
  const { context, page, ids } = await newUser(browser, { profiles: [['Alex', PIN_A]] });
  await openPin(page, 'Alex');
  await page.getByRole('link', { name: 'Retour aux profils' }).click();
  await page.waitForURL(/\/profiles$/, { timeout: 15000 });
  assert.equal(await overlay(page), 0);
  const view = await (await page.request.get(`${BASE}/api/profiles`)).json();
  assert.equal(view.selectedProfileId, null, 'nothing was selected');
  assert.equal(view.profiles[0].locked, true);
  await page.goto(`${BASE}/`);
  await page.waitForURL(/\/profiles$/, { timeout: 15000 });
  await page.goto(`${BASE}/profiles/${ids.Alex}/unlock`);
  await page.locator('#profile-pin').waitFor({ state: 'attached' });
  await page.goto(`${BASE}/profiles/c000000000000000000000000/unlock`);
  await page.waitForURL(/\/profiles$/, { timeout: 15000 });
  await context.close();
});

check('profile without a PIN (created before the feature): two-step setup with weak-code and mismatch errors, then it unlocks', async () => {
  const { context, page, ids } = await newUser(browser, { profiles: [['Alex', PIN_A]] });
  const bodies = [];
  await page.route('**/api/profiles', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    const response = await route.fetch();
    const json = await response.json();
    json.profiles = json.profiles.map((profile) => ({ ...profile, hasPin: false }));
    return route.fulfill({ response, json });
  });
  await page.route('**/api/profiles/*/pin', async (route) => {
    bodies.push(route.request().postDataJSON());
    const json = (await (await page.request.get(`${BASE}/api/profiles`)).json());
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ unlocked: true, selectedProfileId: ids.Alex, profile: { ...json.profiles[0], locked: false, hasPin: true } }) });
  });
  await page.goto(`${BASE}/profiles/${ids.Alex}/unlock`);
  await page.getByRole('heading', { name: 'Créez votre code PIN' }).waitFor({ timeout: 15000 });
  await page.waitForFunction(() => document.activeElement?.id === 'profile-pin');
  await page.keyboard.type('1234');
  await page.locator('#pin-problem').waitFor();
  assert.match(await page.locator('#pin-problem').textContent(), /./, 'weak code refused with an explanation');
  assert.equal(bodies.length, 0, 'a weak code never reaches the server');
  await page.keyboard.type('8260');
  await page.getByRole('heading', { name: 'Confirmez votre code PIN' }).waitFor();
  await page.keyboard.type('8261');
  await page.locator('#pin-problem').filter({ hasText: 'ne correspondent pas' }).waitFor();
  await page.getByRole('heading', { name: 'Créez votre code PIN' }).waitFor();
  await page.keyboard.type('8260');
  await page.getByRole('heading', { name: 'Confirmez votre code PIN' }).waitFor();
  await page.keyboard.type('8260');
  await page.waitForURL(`${BASE}/`, { timeout: 40000 });
  assert.equal(bodies.length, 1);
  assert.deepEqual(Object.keys(bodies[0]).sort(), ['confirmPin', 'pin'].sort().concat(Object.keys(bodies[0]).filter((key) => key === 'password')).sort());
  await context.close();
});

check('profile editor: creating a profile requires a PIN and its confirmation; managing an existing one asks for the account password', async () => {
  const { context, page } = await newUser(browser, { profiles: [['Alex', PIN_A]] });
  await page.getByRole('button', { name: 'Créer un profil' }).click();
  await page.locator('#profile-name').fill('Nora');
  await page.locator('#profile-new-pin').focus();
  await page.keyboard.type('2951');
  await page.locator('#profile-new-pin-confirm').focus();
  await page.keyboard.type('2952');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.locator('form [role="alert"]').filter({ hasText: 'ne correspondent pas' }).waitFor();
  await page.locator('#profile-new-pin-confirm').focus();
  await page.keyboard.press('Backspace');
  await page.keyboard.type('1');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.getByRole('button', { name: 'Continuer avec Nora' }).waitFor({ timeout: 15000 });
  // edit Alex: password required
  await page.getByRole('button', { name: 'Gérer les profils' }).click();
  await page.getByRole('button', { name: 'Modifier le profil Alex' }).click();
  await page.locator('#profile-name').fill('Alexandre');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.locator('form [role="alert"]').filter({ hasText: /mot de passe/i }).waitFor();
  await page.locator('#profile-account-password').fill('Wrong-Password-123');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.locator('form [role="alert"]').filter({ hasText: /incorrect/i }).waitFor({ timeout: 15000 });
  await page.locator('#profile-account-password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.getByRole('button', { name: 'Modifier le profil Alexandre' }).waitFor({ timeout: 15000 });
  // the new profile opens with its own PIN
  await page.getByRole('button', { name: 'Terminer' }).click();
  await openPin(page, 'Nora');
  await page.keyboard.type('2951');
  await page.waitForURL(`${BASE}/`, { timeout: 40000 });
  await context.close();
});

// Opens the editor of a profile and starts the delete confirmation.
const startDelete = async (page, name) => {
  await page.getByRole('button', { name: 'Gérer les profils' }).click();
  await page.getByRole('button', { name: `Modifier le profil ${name}` }).click();
  await page.getByRole('button', { name: 'Supprimer le profil' }).click();
};
const confirmDelete = (page) => page.locator('form').getByRole('button', { name: 'Supprimer', exact: true }).click();

for (const mode of ['typed', 'autofilled']) {
  check(`deleting a profile with a ${mode} account password works (the password reaches the server; empty and wrong are told apart)`, async () => {
    const { context, page } = await newUser(browser, { profiles: [['Alex', PIN_A], ['Sophie', PIN_B]] });
    const deletes = [];
    page.on('request', (request) => { if (request.method() === 'DELETE') deletes.push(request.postDataJSON()); });
    const fillPassword = async (value) => {
      const input = page.locator('#profile-account-password');
      await input.fill('');
      if (mode === 'typed') await input.pressSequentially(value, { delay: 10 });
      else await input.evaluate((el, v) => { // what a browser does when it autofills: set the value, then fire input/change
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, value);
    };
    await startDelete(page, 'Alex');
    // 1. empty password: the client says so and nothing is sent
    await confirmDelete(page);
    await page.locator('form [role="alert"]').filter({ hasText: /Saisissez le mot de passe/ }).waitFor({ timeout: 10000 });
    assert.equal(deletes.length, 0, 'nothing sent with an empty password');
    // 2. wrong password: reported as incorrect, not as missing
    await fillPassword('Wrong-Password-123');
    await page.getByRole('button', { name: 'Supprimer le profil' }).click();
    await confirmDelete(page);
    await page.locator('form [role="alert"]').filter({ hasText: /incorrect/i }).waitFor({ timeout: 15000 });
    assert.equal(deletes.length, 1);
    assert.equal(deletes[0].password, 'Wrong-Password-123');
    // 3. the right password deletes the profile
    await fillPassword(PASSWORD);
    await page.getByRole('button', { name: 'Supprimer le profil' }).click();
    await confirmDelete(page);
    await page.getByRole('button', { name: 'Modifier le profil Alex' }).waitFor({ state: 'detached', timeout: 15000 });
    assert.equal(deletes.length, 2);
    assert.equal(deletes[1].password, PASSWORD, 'the real field value was sent');
    assert.ok(!('parentalPin' in deletes[1]) || deletes[1].parentalPin === undefined, 'no empty parental code is sent');
    assert.equal(await page.getByRole('button', { name: 'Modifier le profil Sophie' }).count(), 1, 'the other profile is untouched');
    await context.close();
  });
}

check('reduced motion: a wrong code shows the error without any shake animation', async () => {
  const { context, page } = await newUser(browser, { reducedMotion: true, profiles: [['Alex', PIN_A]] });
  await openPin(page, 'Alex');
  await page.keyboard.type('1111');
  await page.locator('#pin-problem').waitFor({ timeout: 10000 });
  const animation = await page.locator('[data-testid="pin-boxes"]').evaluate((el) => getComputedStyle(el).animationName);
  assert.equal(animation, 'none');
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
