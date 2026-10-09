/* eslint-disable @typescript-eslint/no-explicit-any -- JSON response bodies in black-box API tests */
// Profile PIN protection, tested through the real HTTP API of a running server backed by an ISOLATED test database.
//   E2E_BASE_URL=http://localhost:4103 [E2E_DATABASE_URL=postgresql://...isolated...] npx tsx --test tests/pin.integration.test.ts
// E2E_NULL_PIN_COMMAND is only needed for the "profile created before PIN protection" test.
// Skipped unless E2E_BASE_URL is set. Never point this at a database you care about.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { execSync } from 'node:child_process';

const BASE = process.env.E2E_BASE_URL;
// Shell command (PROFILE_ID in its environment) that removes that profile's PIN hash in the isolated database.
const NULL_PIN_COMMAND = process.env.E2E_NULL_PIN_COMMAND;
const EXPECT_HTTPS = process.env.E2E_EXPECT_HTTPS === '1';

class Client {
  cookies = new Map<string, string>();

  async request(path: string, init: RequestInit & { json?: unknown } = {}) {
    const headers = new Headers(init.headers);
    if (this.cookies.size) headers.set('cookie', [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '));
    let body = init.body;
    if (init.json !== undefined) {
      headers.set('content-type', 'application/json');
      body = JSON.stringify(init.json);
    }
    const send = () => fetch(`${BASE}${path}`, { ...init, headers, body, redirect: 'manual' });
    // a server restart (legacy-profile test) leaves a stale keep-alive socket behind: retry once on a network error
    const res = await send().catch(() => send());
    for (const raw of res.headers.getSetCookie()) {
      const [pair] = raw.split(';');
      const i = pair.indexOf('=');
      const name = pair.slice(0, i);
      const value = pair.slice(i + 1);
      if (!value || /expires=thu, 01 jan 1970/i.test(raw) || /max-age=0/i.test(raw)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    return res;
  }

  async json(path: string, init: RequestInit & { json?: unknown } = {}) {
    const res = await this.request(path, init);
    const text = await res.text();
    let body: any = null;
    try { body = JSON.parse(text); } catch { /* not JSON */ }
    return { status: res.status, headers: res.headers, body, text };
  }

  async login(email: string, password: string) {
    const { body } = await this.json('/api/auth/csrf');
    return this.request('/api/auth/callback/credentials', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ csrfToken: body.csrfToken, email, password, json: 'true' }).toString(),
    });
  }

  async logout() {
    const { body } = await this.json('/api/auth/csrf');
    return this.request('/api/auth/signout', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ csrfToken: body.csrfToken, json: 'true' }).toString(),
    });
  }
}

const run = Date.now();
const PASSWORD = 'Correct-Horse-Battery-9';
const user = (tag: string) => ({ name: `Pin ${tag}`, email: `cineverse-e2e-pin-${tag}+${run}@example.com`, password: PASSWORD });
const base = { avatar: 'ember', isKids: false, maturityLevel: 18, preferences: ['Action'], language: 'fr-FR' };

async function signedIn(tag: string) {
  const account = user(tag);
  const anon = new Client();
  assert.equal((await anon.json('/api/auth/register', { method: 'POST', json: account })).status, 201);
  const client = new Client();
  await client.login(account.email, account.password);
  return { client, account };
}

async function profileWithPin(client: Client, name: string, pin: string) {
  const created = await client.json('/api/profiles', { method: 'POST', json: { ...base, name, pin, confirmPin: pin } });
  assert.equal(created.status, 201, `creating ${name}`);
  return created.body.profile.id as string;
}

const unlock = (client: Client, id: string, pin: string) => client.json(`/api/profiles/${id}/unlock`, { method: 'POST', json: { pin } });

describe('Profile PIN protection (isolated database)', { skip: !BASE }, () => {
  it('a correct PIN unlocks and selects the profile; the response and cookie reveal nothing sensitive', async () => {
    const { client } = await signedIn('basic');
    const id = await profileWithPin(client, 'Alex', '7392');
    const res = await unlock(client, id, '7392');
    assert.equal(res.status, 200);
    assert.equal(res.body.unlocked, true);
    assert.equal(res.body.selectedProfileId, id);
    assert.equal(res.body.profile.locked, false);
    assert.equal(res.text.includes('PinHash'), false);
    assert.equal(res.text.includes('7392'), false, 'the PIN is never echoed');
    const cookie = res.headers.getSetCookie().find((c) => /cv-unlock/.test(c)) ?? '';
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);
    if (EXPECT_HTTPS) { assert.match(cookie, /;\s*Secure/i); assert.match(cookie, /^__Secure-cv-unlock=/); }
    assert.equal(cookie.includes('7392'), false);
    assert.equal((await client.json('/api/profiles')).body.selectedProfileId, id);
  });

  it('a wrong PIN is refused with one generic answer and unlocks nothing', async () => {
    const { client } = await signedIn('wrong');
    const id = await profileWithPin(client, 'Alex', '7392');
    const res = await unlock(client, id, '1111');
    assert.equal(res.status, 401);
    assert.equal(res.body.code, 'PIN_INCORRECT');
    assert.equal(res.body.error, 'Code PIN incorrect');
    assert.deepEqual(Object.keys(res.body).sort(), ['code', 'error'], 'no hint about digits or attempts');
    assert.equal(res.headers.getSetCookie().some((c) => /cv-unlock=[^;]/.test(c)), false, 'no unlock cookie');
    assert.equal((await client.json('/api/profiles')).body.selectedProfileId, null);
    assert.equal((await client.json(`/api/profiles/${id}/watchlist`, { method: 'POST', json: { mediaId: 'movie:550' } })).status, 403);
  });

  it('rejects malformed PINs without checking anything', async () => {
    const { client } = await signedIn('format');
    const id = await profileWithPin(client, 'Alex', '7392');
    for (const pin of ['', '123', '12345', 'abcd', '12a4', 'dddd']) assert.equal((await unlock(client, id, pin)).status, 400, pin);
    assert.equal((await client.json(`/api/profiles/${id}/unlock`, { method: 'POST', json: {} })).status, 400);
    assert.equal((await client.json(`/api/profiles/${id}/unlock`, { method: 'POST', json: { pin: 7392 } })).status, 400);
  });

  it('locked profiles expose no personal data; only the unlocked one does; switching needs the PIN again', async () => {
    const { client } = await signedIn('switch');
    const a = await profileWithPin(client, 'Alex', '7392');
    const b = await profileWithPin(client, 'Sophie', '5038');
    await unlock(client, a, '7392');
    await client.json(`/api/profiles/${a}/watchlist`, { method: 'POST', json: { mediaId: 'movie:550' } });
    await unlock(client, b, '5038');
    await client.json(`/api/profiles/${b}/watchlist`, { method: 'POST', json: { mediaId: 'movie:27205' } });

    // B is unlocked now, so A is locked again
    let view = (await client.json('/api/profiles')).body;
    assert.equal(view.selectedProfileId, b);
    const lockedA = view.profiles.find((p: any) => p.id === a);
    assert.equal(lockedA.locked, true);
    assert.deepEqual([lockedA.watchlist, lockedA.favorites, lockedA.history, lockedA.preferences], [[], [], [], []]);
    assert.deepEqual(view.profiles.find((p: any) => p.id === b).watchlist, ['movie:27205']);
    assert.equal((await client.json(`/api/profiles/${a}/watchlist`, { method: 'POST', json: { mediaId: 'movie:1' } })).status, 403);
    assert.equal((await client.json('/api/profiles/selected', { method: 'PUT', json: { profileId: a } })).status, 403);
    assert.equal((await client.json('/api/recommendations', { method: 'POST', json: { profileId: a } })).status, 403);

    await unlock(client, a, '7392');
    view = (await client.json('/api/profiles')).body;
    assert.deepEqual(view.profiles.find((p: any) => p.id === a).watchlist, ['movie:550']);
    assert.equal(view.profiles.find((p: any) => p.id === b).locked, true);
  });

  it('every profile-specific route refuses a locked profile', async () => {
    const { client } = await signedIn('routes');
    const id = await profileWithPin(client, 'Alex', '7392');
    const calls: [string, string, unknown?][] = [
      ['POST', `/api/profiles/${id}/watchlist`, { mediaId: 'movie:1' }], ['DELETE', `/api/profiles/${id}/watchlist`, { mediaId: 'movie:1' }],
      ['POST', `/api/profiles/${id}/favorites`, { mediaId: 'movie:1' }], ['DELETE', `/api/profiles/${id}/favorites`, { mediaId: 'movie:1' }],
      ['POST', `/api/profiles/${id}/history`, { mediaId: 'movie:1', positionSeconds: 1, durationSeconds: 9 }], ['DELETE', `/api/profiles/${id}/history`, { mediaId: 'movie:1' }],
      ['PUT', '/api/profiles/selected', { profileId: id }], ['POST', '/api/recommendations', { profileId: id }],
    ];
    for (const [method, path, json] of calls) {
      const res = await client.json(path, { method, json });
      assert.equal(res.status, 403, `${method} ${path} returned ${res.status}`);
      assert.equal(res.body.code, 'PROFILE_LOCKED');
    }
    const noProfile = await client.json('/api/recommendations', { method: 'POST', json: {} });
    assert.deepEqual(noProfile.body.recommendations, [], 'with nothing unlocked there is nothing personal to recommend');
  });

  it('the unlock cannot be forged, copied to another login session, or kept after logout', async () => {
    const { client, account } = await signedIn('session');
    const id = await profileWithPin(client, 'Alex', '7392');
    await unlock(client, id, '7392');
    const stolen = client.cookies.get('cv-unlock') ?? client.cookies.get('__Secure-cv-unlock') ?? '';
    const name = client.cookies.has('cv-unlock') ? 'cv-unlock' : '__Secure-cv-unlock';
    assert.ok(stolen);

    // a different login session of the same user, carrying the copied unlock cookie, is still locked
    const other = new Client();
    await other.login(account.email, account.password);
    other.cookies.set(name, stolen);
    assert.equal((await other.json('/api/profiles')).body.selectedProfileId, null);
    assert.equal((await other.json(`/api/profiles/${id}/watchlist`, { method: 'POST', json: { mediaId: 'movie:1' } })).status, 403);

    // tampered and garbage cookies are ignored
    const [body] = stolen.split('.');
    for (const forged of [`${body}.AAAA`, `${body}x.${stolen.split('.')[1]}`, 'garbage', `${stolen}.extra`]) {
      const attacker = new Client();
      await attacker.login(account.email, account.password);
      attacker.cookies.set(name, forged);
      assert.equal((await attacker.json('/api/profiles')).body.selectedProfileId, null, `forged: ${forged.slice(0, 12)}`);
    }

    // after logout and a fresh login, the old cookie does nothing
    await client.logout();
    const again = new Client();
    await again.login(account.email, account.password);
    again.cookies.set(name, stolen);
    assert.equal((await again.json('/api/profiles')).body.selectedProfileId, null);
  });

  it('five wrong PINs lock the profile with a 429, even for the right PIN, and other profiles are unaffected', async () => {
    const { client } = await signedIn('lock');
    const a = await profileWithPin(client, 'Alex', '7392');
    const b = await profileWithPin(client, 'Sophie', '5038');
    for (let i = 0; i < 5; i++) assert.equal((await unlock(client, a, '1111')).status, 401, `attempt ${i + 1}`);
    const locked = await unlock(client, a, '1111');
    assert.equal(locked.status, 429);
    assert.equal(locked.body.code, 'PIN_LOCKED');
    assert.ok(Number(locked.headers.get('retry-after')) > 0);
    assert.ok(locked.body.retryAfterSeconds > 0);
    const rightButLocked = await unlock(client, a, '7392');
    assert.equal(rightButLocked.status, 429, 'the correct PIN does not bypass the lockout');
    assert.equal(rightButLocked.headers.getSetCookie().some((c) => /cv-unlock=[^;]/.test(c)), false);
    assert.equal((await unlock(client, b, '5038')).status, 200, 'another profile still unlocks');
  });

  it('a burst of parallel guesses cannot beat the limit: at most five are ever evaluated', async () => {
    const { client } = await signedIn('burst');
    const id = await profileWithPin(client, 'Alex', '7392');
    const guesses = ['0001', '0002', '0003', '0004', '0005', '0006', '0007', '0008', '0009', '0010', '0011', '0012', '0013', '0014', '0015', '0016', '0017', '0018', '0019', '7392'];
    const results = await Promise.all(guesses.map((pin) => unlock(client, id, pin)));
    const evaluated = results.filter((r) => r.status === 401 || r.status === 200).length;
    assert.ok(evaluated <= 5, `${evaluated} guesses were evaluated`);
    assert.ok(results.filter((r) => r.status === 429).length >= 15, 'the rest were locked out');
  });

  it('a correct PIN clears the profile’s earlier failures', async () => {
    const { client } = await signedIn('reset');
    const id = await profileWithPin(client, 'Alex', '7392');
    for (let i = 0; i < 3; i++) assert.equal((await unlock(client, id, '2222')).status, 401);
    assert.equal((await unlock(client, id, '7392')).status, 200);
    for (let i = 0; i < 4; i++) assert.equal((await unlock(client, id, '2222')).status, 401, `fresh allowance, attempt ${i + 1}`);
  });

  it("someone else's account cannot unlock, change or even see my profile", async () => {
    const mine = await signedIn('owner');
    const theirs = await signedIn('intruder');
    const id = await profileWithPin(mine.client, 'Alex', '7392');
    assert.equal((await unlock(theirs.client, id, '7392')).status, 404);
    assert.equal((await theirs.client.json(`/api/profiles/${id}/pin`, { method: 'PUT', json: { pin: '5038', confirmPin: '5038', password: PASSWORD } })).status, 404);
    assert.deepEqual((await theirs.client.json('/api/profiles')).body.profiles, []);
  });

  it('creating profiles needs a valid, confirmed, non-trivial PIN', async () => {
    const { client } = await signedIn('create');
    const create = (extra: object) => client.json('/api/profiles', { method: 'POST', json: { ...base, name: 'X', ...extra } });
    assert.equal((await create({})).status, 400, 'no PIN');
    assert.equal((await create({ pin: '7392' })).status, 400, 'no confirmation');
    assert.equal((await create({ pin: '7392', confirmPin: '7391' })).status, 400, 'mismatch');
    for (const weak of ['0000', '1234', '1111', '4321', '2580']) assert.equal((await create({ pin: weak, confirmPin: weak })).status, 400, `weak ${weak}`);
    for (const bad of ['abcd', '123', '12345']) assert.equal((await create({ pin: bad, confirmPin: bad })).status, 400, `bad ${bad}`);
    assert.equal((await create({ pin: '7392', confirmPin: '7392' })).status, 201);
  });

  it('changing a PIN needs the account password, works with it, and clears a lockout', async () => {
    const { client } = await signedIn('change');
    const id = await profileWithPin(client, 'Alex', '7392');
    const put = (json: object) => client.json(`/api/profiles/${id}/pin`, { method: 'PUT', json });
    assert.equal((await put({ pin: '5038', confirmPin: '5038' })).status, 400, 'password required');
    assert.equal((await put({ pin: '5038', confirmPin: '5038', password: 'Wrong-Password-123' })).status, 403);
    assert.equal((await put({ pin: '1234', confirmPin: '1234', password: PASSWORD })).status, 400, 'weak');
    for (let i = 0; i < 6; i++) await unlock(client, id, '9999'); // lock it
    assert.equal((await unlock(client, id, '7392')).status, 429);
    const changed = await put({ pin: '5038', confirmPin: '5038', password: PASSWORD });
    assert.equal(changed.status, 200);
    assert.equal((await unlock(client, id, '7392')).status, 401, 'the old PIN no longer works');
    assert.equal((await unlock(client, id, '5038')).status, 200, 'the new PIN works and the lockout was cleared');
  });

  it('editing and deleting a profile need the account password (fresh authentication)', async () => {
    const { client } = await signedIn('manage');
    const id = await profileWithPin(client, 'Alex', '7392');
    assert.equal((await client.json(`/api/profiles/${id}`, { method: 'PATCH', json: { name: 'Renamed' } })).status, 400);
    assert.equal((await client.json(`/api/profiles/${id}`, { method: 'PATCH', json: { name: 'Renamed', password: 'Wrong-Password-123' } })).status, 403);
    assert.equal((await client.json(`/api/profiles/${id}`, { method: 'DELETE', json: {} })).status, 400);
    assert.equal((await client.json(`/api/profiles/${id}`, { method: 'DELETE', json: { password: 'Wrong-Password-123' } })).status, 403);
    const renamed = await client.json(`/api/profiles/${id}`, { method: 'PATCH', json: { name: 'Renamed', password: PASSWORD } });
    assert.equal(renamed.status, 200);
    assert.equal(renamed.body.profile.locked, true, 'editing does not unlock the profile');
    assert.equal((await client.json(`/api/profiles/${id}`, { method: 'DELETE', json: { password: PASSWORD } })).status, 200);
  });

  it('deleting distinguishes an empty password, a wrong one and a malformed field; the editor’s empty parental code is not an error', async () => {
    const { client } = await signedIn('delete');
    const id = await profileWithPin(client, 'Alex', '7392');
    const del = (json: unknown) => client.json(`/api/profiles/${id}`, { method: 'DELETE', json });
    for (const empty of [{}, { password: '' }, { password: '', parentalPin: '' }, { parentalPin: '' }]) {
      const res = await del(empty);
      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'PASSWORD_REQUIRED', 'empty password is reported as such');
    }
    const wrong = await del({ password: 'Wrong-Password-123', parentalPin: '' });
    assert.equal(wrong.status, 403);
    assert.equal(wrong.body.code, 'PASSWORD_INCORRECT', 'a wrong password is reported as wrong, not as missing');
    const malformed = await del({ password: PASSWORD, parentalPin: 'abc' });
    assert.equal(malformed.status, 400);
    assert.equal(malformed.body.code, 'INVALID_REQUEST', 'a malformed field is not blamed on the password');
    assert.equal(malformed.text.includes(PASSWORD), false, 'the password is never echoed');
    // regression: the profile editor sends parentalPin: "" for adult profiles
    assert.equal((await del({ password: PASSWORD, parentalPin: '' })).status, 200);
    assert.deepEqual((await client.json('/api/profiles')).body.profiles, []);
  });

  it('leaving a profile clears the selection and the unlock', async () => {
    const { client } = await signedIn('leave');
    const id = await profileWithPin(client, 'Alex', '7392');
    await unlock(client, id, '7392');
    assert.equal((await client.json('/api/profiles/selected', { method: 'PUT', json: { profileId: null } })).status, 200);
    assert.equal((await client.json('/api/profiles')).body.selectedProfileId, null);
    assert.equal((await client.json(`/api/profiles/${id}/watchlist`, { method: 'POST', json: { mediaId: 'movie:1' } })).status, 403);
  });

  it('a profile created before PIN protection keeps its data and sets its first PIN safely', { skip: !NULL_PIN_COMMAND }, async () => {
    const { client, account } = await signedIn('legacy');
    const id = await profileWithPin(client, 'Alex', '7392');
    await unlock(client, id, '7392');
    await client.json(`/api/profiles/${id}/watchlist`, { method: 'POST', json: { mediaId: 'movie:550' } });
    await client.json(`/api/profiles/${id}/favorites`, { method: 'POST', json: { mediaId: 'tv:1399' } });

    // simulate a profile that existed before this feature: no PIN hash, data intact
    execSync(NULL_PIN_COMMAND!, { env: { ...process.env, PROFILE_ID: id }, stdio: 'ignore' });
    await client.login(account.email, account.password); // the test harness restarts the database: start a fresh login session
    await client.json('/api/profiles/selected', { method: 'PUT', json: { profileId: null } });

    const listed = (await client.json('/api/profiles')).body.profiles.find((p: any) => p.id === id);
    assert.equal(listed.hasPin, false);
    assert.equal(listed.locked, true);
    assert.equal((await unlock(client, id, '7392')).status, 409);
    assert.equal((await unlock(client, id, '7392')).body.code, 'PIN_SETUP_REQUIRED');
    const gated = await client.json(`/api/profiles/${id}/watchlist`, { method: 'POST', json: { mediaId: 'movie:1' } });
    assert.equal(gated.status, 403);
    assert.equal(gated.body.code, 'PIN_SETUP_REQUIRED');

    const put = (json: object) => client.json(`/api/profiles/${id}/pin`, { method: 'PUT', json });
    assert.equal((await put({ pin: '1234', confirmPin: '1234' })).status, 400, 'weak first PIN refused');
    assert.equal((await put({ pin: '5038', confirmPin: '5039' })).status, 400, 'mismatch refused');
    const setup = await put({ pin: '5038', confirmPin: '5038' });
    assert.equal(setup.status, 200, 'the first PIN needs no password');
    assert.equal(setup.body.unlocked, true);
    assert.equal(setup.body.profile.hasPin, true);
    assert.deepEqual(setup.body.profile.watchlist, ['movie:550'], 'no data was lost');
    assert.deepEqual(setup.body.profile.favorites, ['tv:1399']);

    // from now on changing it needs the password, and the new PIN works
    assert.equal((await put({ pin: '2951', confirmPin: '2951' })).status, 400);
    assert.equal((await unlock(client, id, '5038')).status, 200);
    assert.equal((await unlock(client, id, '7392')).status, 401);
  });
});
