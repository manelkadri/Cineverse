/* global window, document, performance, requestAnimationFrame, MutationObserver, getComputedStyle */
// Browser tests for the cinematic profile transition (real Chromium, real rendering).
//
//   npm i -D playwright && npx playwright install chromium     (not a project dependency)
//   E2E_BASE_URL=http://localhost:4101 node tests/browser/cinematic-transition.mjs
//
// Point it at a production server backed by an ISOLATED test database: it registers users and creates profiles.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4101';
const SEL = '[data-cinematic-transition]';
const PIN = '7392'; // every profile is protected by its own PIN
const results = [];
const check = (name, fn) => results.push({ name, fn });

// Installed in every document: counts overlays that get added, and records the bar of the overlay on every frame.
const INIT = () => {
  const selector = '[data-cinematic-transition]';
  const ct = (window.__ct = { added: 0, maxSimultaneous: 0, frames: [], removedAt: null, seen: false });
  new MutationObserver((records) => {
    for (const record of records) for (const node of record.addedNodes) if (node.nodeType === 1 && (node.matches(selector) || node.querySelector(selector))) ct.added++;
    const count = document.querySelectorAll(selector).length;
    if (count > ct.maxSimultaneous) ct.maxSimultaneous = count;
  }).observe(document, { childList: true, subtree: true });
  const loop = () => {
    const el = document.querySelector(selector);
    if (el) {
      const fill = el.querySelector('.cv-bar__fill');
      let scale = null;
      if (fill) {
        const matrix = getComputedStyle(fill).transform;
        const parsed = matrix && matrix.match(/matrix\(([^)]+)\)/);
        scale = parsed ? parseFloat(parsed[1].split(',')[0]) : matrix === 'none' ? 1 : null;
      }
      ct.frames.push({ t: performance.now(), scale, phase: el.dataset.phase, opacity: Number(getComputedStyle(el).opacity) });
      ct.seen = true;
    } else if (ct.seen && ct.removedAt === null) ct.removedAt = performance.now();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
};

const resetLog = (page) => page.evaluate(() => { Object.assign(window.__ct, { added: 0, maxSimultaneous: 0, frames: [], removedAt: null, seen: false }); });
const readLog = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__ct)));
const overlays = (page) => page.locator(SEL).count();

function analyse(log) {
  const scales = log.frames.map((frame) => frame.scale).filter((value) => value !== null);
  let monotonic = true;
  for (let i = 1; i < scales.length; i++) if (scales[i] < scales[i - 1] - 1e-6) monotonic = false;
  return {
    frames: scales.length, first: scales[0], last: scales[scales.length - 1], max: Math.max(...scales), monotonic,
    phases: [...new Set(log.frames.map((frame) => frame.phase))],
    durationMs: log.frames.length ? Math.round(log.frames[log.frames.length - 1].t - log.frames[0].t) : 0,
  };
}

async function newUser(browser, { viewport, reducedMotion = false, profiles = ['Alex', 'Sophie'] }) {
  const context = await browser.newContext({ viewport, reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  await context.addInitScript(INIT);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message.slice(0, 160)));
  await page.goto(`${BASE}/login`);
  assert.equal(await overlays(page), 0, 'no cinematic overlay on the login page');
  await page.getByRole('button', { name: 'Inscription' }).click();
  await page.getByLabel('Nom').fill('Cinematic Tester');
  await page.getByLabel('Email', { exact: true }).fill(`cinematic-${Date.now()}-${Math.round(Math.random() * 1e6)}@example.com`);
  await page.locator('form input').nth(2).fill('Browser-Test-Pass-9x');
  await page.getByRole('button', { name: 'Créer le compte' }).click();
  await page.waitForURL(/\/profiles/, { timeout: 20000 });
  for (const name of profiles) {
    const response = await page.request.post(`${BASE}/api/profiles`, { data: { name, avatar: 'ember', isKids: false, maturityLevel: 18, preferences: [], language: 'fr-FR', pin: PIN, confirmPin: PIN } });
    assert.equal(response.status(), 201, `creating profile ${name}`);
  }
  await page.goto(`${BASE}/profiles`);
  await page.getByRole('heading', { name: /Qui regarde/ }).waitFor();
  await page.getByRole('button', { name: `Continuer avec ${profiles[0]}` }).waitFor();
  return { context, page, errors };
}

const waitForIntroEnd = (page, timeout = 40000) => page.waitForFunction(() => window.__ct.removedAt !== null, null, { timeout }).catch(async (error) => {
  const state = await page.evaluate(() => ({ seen: window.__ct.seen, frames: window.__ct.frames.length, dots: document.querySelectorAll('[data-pin-dot]').length, problem: document.querySelector('#pin-problem')?.textContent ?? null })).catch(() => null);
  throw new Error(`${error.message.split('\n')[0]} at ${page.url()} ${JSON.stringify(state)}`);
});
const heroVisible = (page) => page.locator('h1').first().waitFor({ timeout: 30000 });

// Opens the PIN screen of a profile and types its code (the field is focused automatically).
async function openAndType(page, name, pin = PIN) {
  await page.getByRole('button', { name: `Continuer avec ${name}` }).click();
  await page.waitForURL(/\/unlock$/, { timeout: 20000 });
  await page.locator('#profile-pin').waitFor({ state: 'attached' });
  await page.keyboard.type(pin, { delay: 40 });
}

async function selectAndWatch(page, name) {
  await resetLog(page);
  await page.getByRole('button', { name: `Continuer avec ${name}` }).click();
  // choosing a profile opens its PIN screen; the cinematic intro starts only once the PIN was accepted
  await page.waitForURL(/\/unlock$/, { timeout: 20000 });
  assert.equal(await overlays(page), 0, 'no cinematic overlay while the PIN is still being asked');
  await page.locator('#profile-pin').waitFor({ state: 'attached' });
  await page.keyboard.type(PIN, { delay: 40 });
  await waitForIntroEnd(page);
  await page.waitForURL(`${BASE}/`, { timeout: 20000 });
  await heroVisible(page);
  const log = await readLog(page);
  return { log, stats: analyse(log) };
}

const VIEWPORTS = [['mobile', { width: 375, height: 812 }], ['tablet', { width: 768, height: 1024 }], ['desktop', { width: 1440, height: 900 }]];

for (const [vp, viewport] of VIEWPORTS) {
  check(`[${vp}] A. login -> profile screen -> select profile: the cinematic intro plays exactly once, bar 0% to 100% left to right, then the homepage of that profile`, async () => {
    const { context, page, errors } = await newUser(browser, { viewport });
    assert.equal(await overlays(page), 0, 'no overlay on the profile selection screen itself');
    const { log, stats } = await selectAndWatch(page, 'Alex');
    assert.equal(log.added, 1, 'overlay added exactly once');
    assert.equal(log.maxSimultaneous, 1, 'never two overlays');
    assert.ok(stats.first <= 0.03, `starts at 0% (first frame ${stats.first})`);
    assert.ok(stats.monotonic, 'bar never moves backwards');
    assert.ok(stats.last >= 0.999 && stats.max <= 1.0000001, `ends at exactly 100% (last ${stats.last}, max ${stats.max})`);
    assert.ok(stats.phases.includes('completing') || stats.phases.includes('holding'), `went through completion (${stats.phases})`);
    assert.equal(await overlays(page), 0, 'overlay removed afterwards');
    await page.getByText('Recommandé pour Alex').first().waitFor({ timeout: 15000 });
    assert.deepEqual(errors, []);
    await context.close();
  });

  check(`[${vp}] B/C. navigation, search, filters, details, back/forward and scrolling never show the cinematic loader`, async () => {
    const { context, page } = await newUser(browser, { viewport });
    await selectAndWatch(page, 'Alex');
    await resetLog(page);
    const click = async (name) => {
      const link = page.locator(`nav a:has-text("${name}")`).first();
      if (await link.isVisible().catch(() => false)) { await link.click(); await page.waitForTimeout(700); return true; }
      return false;
    };
    const push = async (path) => { await page.evaluate((p) => window.next.router.push(p), path); await page.waitForTimeout(900); };
    for (const [label, path] of [['Films', '/films-series-catalog?type=movie'], ['Séries', '/films-series-catalog?type=tv'], ['Ma liste', '/my-list'], ['Accueil', '/']]) {
      if (!(await click(label))) await push(path);
      assert.equal(await overlays(page), 0, `no overlay after ${label}`);
    }
    await push('/films-series-catalog?type=tv&genre=Action'); // changing URL search params / filters
    await push('/films-series-catalog?q=Interstellar'); // search
    await page.locator('a[href*="movie-series-detail"]').first().click(); // opening details
    await page.waitForURL(/movie-series-detail/, { timeout: 20000 });
    await page.waitForTimeout(900);
    await page.goBack(); await page.waitForTimeout(700);
    await page.goBack(); await page.waitForTimeout(700);
    await page.goForward(); await page.waitForTimeout(700);
    await push('/');
    for (let y = 0; y <= 3000; y += 600) { await page.evaluate((yy) => window.scrollTo(0, yy), y); await page.waitForTimeout(150); }
    await page.evaluate(() => { for (const row of document.querySelectorAll('.overflow-x-auto')) row.scrollBy({ left: 400 }); });
    await page.waitForTimeout(500);
    const log = await readLog(page);
    assert.equal(log.added, 0, `the cinematic overlay was added ${log.added} time(s) during ordinary navigation`);
    assert.equal(await overlays(page), 0);
    await context.close();
  });

  check(`[${vp}] D. refreshing after a profile was selected does not replay the intro`, async () => {
    const { context, page } = await newUser(browser, { viewport });
    await selectAndWatch(page, 'Alex');
    await page.reload();
    await heroVisible(page);
    await page.waitForTimeout(2000);
    const log = await readLog(page);
    assert.equal(log.added, 0, 'no cinematic overlay after reload');
    assert.equal(await overlays(page), 0);
    await context.close();
  });

  check(`[${vp}] E. returning to profile selection and choosing another profile plays the intro again, with that profile's homepage`, async () => {
    const { context, page } = await newUser(browser, { viewport });
    await selectAndWatch(page, 'Alex');
    await page.goto(`${BASE}/profiles`);
    await page.getByRole('button', { name: 'Continuer avec Sophie' }).waitFor();
    assert.equal(await overlays(page), 0, 'not shown just for opening the selection screen');
    const { log, stats } = await selectAndWatch(page, 'Sophie');
    assert.equal(log.added, 1);
    assert.ok(stats.monotonic && stats.first <= 0.03 && stats.last >= 0.999);
    await page.getByText('Recommandé pour Sophie').first().waitFor({ timeout: 15000 });
    assert.equal(await page.getByText('Recommandé pour Alex').count(), 0, "Alex's data is not shown for Sophie");
    await context.close();
  });
}

const DESKTOP = { width: 1440, height: 900 };

check('F. a failed PIN verification (server error) shows an error, no false success, no loader, and a retry then works', async () => {
  const { context, page } = await newUser(browser, { viewport: DESKTOP });
  await page.route('**/api/profiles/*/unlock', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Erreur simulée' }) }));
  await resetLog(page);
  await openAndType(page, 'Alex');
  await page.locator('[role="alert"]').first().waitFor({ timeout: 10000 });
  await page.waitForTimeout(800);
  assert.equal((await readLog(page)).added, 0, 'no overlay for a failed verification');
  assert.match(page.url(), /\/unlock$/);
  await page.unroute('**/api/profiles/*/unlock');
  await page.keyboard.type(PIN, { delay: 40 }); // the field was cleared and refocused
  await waitForIntroEnd(page);
  const log = await readLog(page);
  assert.equal(log.added, 1, 'the retry plays the intro once');
  await context.close();
});

check('G. a slow homepage: the bar never reaches 100% before the data is ready, then completes', async () => {
  const { context, page } = await newUser(browser, { viewport: DESKTOP });
  let releasedAt = null;
  await page.route(/\/api\/(recommendations|tmdb\/media)/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 4500));
    releasedAt ??= await page.evaluate(() => performance.now());
    await route.continue();
  });
  const { log, stats } = await selectAndWatch(page, 'Alex');
  assert.ok(releasedAt !== null, 'the delayed request was released');
  const before = log.frames.filter((frame) => frame.t < releasedAt && frame.scale !== null).map((frame) => frame.scale);
  assert.ok(before.length > 20);
  assert.ok(Math.max(...before) <= 0.9 + 1e-6, `bar stayed at or under 90% while waiting (max ${Math.max(...before)})`);
  assert.ok(Math.max(...before) > 0.3, 'but it did advance while waiting');
  assert.ok(stats.monotonic && stats.last >= 0.999);
  assert.ok(stats.durationMs >= 4400, `the intro waited for the data (${stats.durationMs} ms)`);
  await context.close();
});

check('H. a fast homepage completes promptly with no long artificial wait', async () => {
  const { context, page } = await newUser(browser, { viewport: DESKTOP });
  const { stats } = await selectAndWatch(page, 'Alex');
  assert.ok(stats.durationMs < 5000, `intro lasted ${stats.durationMs} ms`);
  assert.ok(stats.monotonic && stats.first <= 0.03 && stats.last >= 0.999, `stats ${JSON.stringify({ m: stats.monotonic, f: stats.first, l: stats.last, n: stats.frames, p: stats.phases })}`);
  console.log(`      (fast homepage: intro lasted ${stats.durationMs} ms)`);
  await context.close();
});

check('J. typing the code verifies it once and plays one intro (no duplicate submit)', async () => {
  const { context, page } = await newUser(browser, { viewport: DESKTOP });
  let unlocks = 0;
  await page.route('**/api/profiles/*/unlock', (route) => { unlocks++; return route.continue(); });
  await resetLog(page);
  await page.getByRole('button', { name: 'Continuer avec Alex' }).dblclick();
  await page.waitForURL(/\/unlock$/, { timeout: 20000 });
  await page.locator('#profile-pin').waitFor({ state: 'attached' });
  await page.keyboard.type(PIN + PIN, { delay: 25 }); // extra digits after the 4th are ignored
  await waitForIntroEnd(page);
  const log = await readLog(page);
  assert.equal(unlocks, 1, 'one verification request');
  assert.equal(log.added, 1);
  assert.equal(log.maxSimultaneous, 1);
  await context.close();
});

check('K. reduced motion: the bar advances in coarse steps, never backwards, and still ends at 100%', async () => {
  const { context, page } = await newUser(browser, { viewport: DESKTOP, reducedMotion: true });
  const { log, stats } = await selectAndWatch(page, 'Alex');
  assert.equal(log.added, 1);
  assert.ok(stats.monotonic && stats.last >= 0.999);
  const allowed = new Set([0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6, 1].map((v) => Number(v.toFixed(4))));
  for (const frame of log.frames) if (frame.scale !== null) assert.ok(allowed.has(Number(frame.scale.toFixed(4))), `scale ${frame.scale} is not a coarse step`);
  await context.close();
});

// Requests that never answer while `hang.on` is true; releasing them would let the intro finish, so they stay stuck.
const hangRequests = async (page, hang) => page.route(/\/api\/(recommendations|tmdb\/media)/, (route) => (hang.on ? new Promise(() => undefined) : route.continue()));

check('L. a homepage that never becomes ready shows recovery options instead of an endless loader (never fakes 100%), and Retour aux profils leaves cleanly', async () => {
  const { context, page } = await newUser(browser, { viewport: DESKTOP });
  await hangRequests(page, { on: true });
  await resetLog(page);
  await openAndType(page, 'Alex');
  await page.getByRole('button', { name: 'Réessayer' }).waitFor({ timeout: 30000 });
  const log = await readLog(page);
  const stats = analyse(log);
  assert.ok(stats.max <= 0.9 + 1e-6, `never faked completion (max ${stats.max})`);
  assert.equal(log.frames[log.frames.length - 1].phase, 'stalled');
  await page.getByRole('button', { name: 'Retour aux profils' }).click();
  await page.waitForURL(/\/profiles/, { timeout: 15000 });
  await page.waitForTimeout(800);
  assert.equal(await overlays(page), 0, 'recovery leaves no overlay behind');
  await context.close();
});

check('M. Réessayer reloads the homepage for real and ends up on it, with no intro replay', async () => {
  const { context, page } = await newUser(browser, { viewport: DESKTOP });
  const hang = { on: true };
  await hangRequests(page, hang);
  await openAndType(page, 'Alex');
  await page.getByRole('button', { name: 'Réessayer' }).waitFor({ timeout: 30000 });
  hang.on = false; // the stuck requests stay stuck; new ones (after the reload) go through
  await page.getByRole('button', { name: 'Réessayer' }).click();
  await page.waitForURL(`${BASE}/`, { timeout: 20000, waitUntil: 'commit' });
  await heroVisible(page);
  await page.getByText('Recommandé pour Alex').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
  assert.equal((await readLog(page)).added, 0, 'a reload never replays the intro');
  assert.equal(await overlays(page), 0);
  await context.close();
});

const browser = await chromium.launch();
let failed = 0;
const only = process.env.ONLY; // optional: run just the checks whose name contains this text
for (const { name, fn } of results.filter((item) => !only || item.name.includes(only))) {
  try { await fn(); console.log(`PASS  ${name}`); }
  catch (error) { failed++; console.log(`FAIL  ${name}\n      ${String(error.message).split('\n').slice(0, 3).join(' | ').slice(0, 400)}`); }
}
await browser.close();
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
