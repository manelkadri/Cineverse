/* eslint-disable @typescript-eslint/no-explicit-any -- JSON response bodies in black-box API tests */
// Focused security tests against a running server backed by an ISOLATED test database.
// Run: E2E_BASE_URL=http://localhost:4103 [E2E_EXPECT_HTTPS=1] npx tsx --test tests/security.integration.test.ts
// Start the server WITHOUT AUTHORIZED_PLAYBACK_ENABLED so the playback gate is exercised.
// Skipped unless E2E_BASE_URL is set. Never point this at a database you care about.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { encode } from 'next-auth/jwt';

const BASE = process.env.E2E_BASE_URL;
const EXPECT_HTTPS = process.env.E2E_EXPECT_HTTPS === '1';

class Client {
  cookies = new Map<string, string>();
  extraHeaders: Record<string, string> = {};

  async request(path: string, init: RequestInit & { json?: unknown } = {}) {
    const headers = new Headers(init.headers);
    for (const [k, v] of Object.entries(this.extraHeaders)) headers.set(k, v);
    if (this.cookies.size) headers.set('cookie', [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '));
    let body = init.body;
    if (init.json !== undefined) {
      headers.set('content-type', 'application/json');
      body = JSON.stringify(init.json);
    }
    const res = await fetch(`${BASE}${path}`, { ...init, headers, body, redirect: 'manual' });
    for (const raw of res.headers.getSetCookie()) {
      const [pair] = raw.split(';');
      const i = pair.indexOf('=');
      const name = pair.slice(0, i);
      const value = pair.slice(i + 1);
      if (!value || /expires=thu, 01 jan 1970/i.test(raw)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    return res;
  }

  async json(path: string, init: RequestInit & { json?: unknown } = {}) {
    const res = await this.request(path, init);
    return { status: res.status, headers: res.headers, body: (await res.json().catch(() => null)) as any };
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

  cookieHeader() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }
}

const run = Date.now();
const PASSWORD = 'Correct-Horse-Battery-9';
const user = (tag: string) => ({ name: `Sec ${tag}`, email: `cineverse-e2e-sec-${tag}+${run}@example.com`, password: PASSWORD });
const profile = (name: string) => ({ name, avatar: 'avatar-1', isKids: false, maturityLevel: 18, preferences: ['Action'], language: 'fr-FR' });

describe('CINEVERSE security (isolated database)', { skip: !BASE }, () => {
  const anon = new Client();
  const alice = user('alice');
  const bob = user('bob');
  const aliceClient = new Client();
  const bobClient = new Client();
  let aliceProfileId = '';

  it('sets up two accounts and a profile with data for Alice', async () => {
    assert.equal((await anon.json('/api/auth/register', { method: 'POST', json: alice })).status, 201);
    assert.equal((await anon.json('/api/auth/register', { method: 'POST', json: bob })).status, 201);
    await aliceClient.login(alice.email, alice.password);
    await bobClient.login(bob.email, bob.password);
    const created = await aliceClient.json('/api/profiles', { method: 'POST', json: profile('AlicePrivate') });
    assert.equal(created.status, 201);
    aliceProfileId = created.body.profile.id;
    await aliceClient.json(`/api/profiles/${aliceProfileId}/watchlist`, { method: 'POST', json: { mediaId: 'movie:550' } });
    await aliceClient.json(`/api/profiles/${aliceProfileId}/favorites`, { method: 'POST', json: { mediaId: 'tv:1399' } });
  });

  it('session cookie is HttpOnly, SameSite=Lax, path / (and Secure + __Secure- over https)', async () => {
    const res = await new Client().login(alice.email, alice.password);
    const cookie = res.headers.getSetCookie().find((c) => /session-token/.test(c)) ?? '';
    assert.ok(cookie, 'session cookie must be issued');
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);
    assert.match(cookie, /Path=\//i);
    if (EXPECT_HTTPS) {
      assert.match(cookie, /;\s*Secure/i);
      assert.match(cookie, /^__Secure-next-auth\.session-token=/);
    }
  });

  it('serves baseline security headers', async () => {
    const res = await anon.request('/login');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(res.headers.get('x-frame-options'));
    assert.ok(res.headers.get('referrer-policy'));
    assert.ok(res.headers.get('permissions-policy'));
  });

  it('rejects every private endpoint without a valid session', async () => {
    const forged = await encode({ token: { userId: 'forged', sid: 'forged' }, secret: 'not-the-real-secret' });
    const garbage = new Client();
    garbage.cookies.set('next-auth.session-token', 'garbage');
    garbage.cookies.set('__Secure-next-auth.session-token', 'garbage');
    const wrongSecret = new Client();
    wrongSecret.cookies.set('next-auth.session-token', forged);
    wrongSecret.cookies.set('__Secure-next-auth.session-token', forged);
    const id = aliceProfileId;
    const calls: [string, string, unknown?][] = [
      ['GET', '/api/profiles'], ['POST', '/api/profiles', profile('x')], ['PUT', '/api/profiles/selected', { profileId: null }],
      ['PATCH', `/api/profiles/${id}`, { name: 'x' }], ['DELETE', `/api/profiles/${id}`],
      ['POST', `/api/profiles/${id}/watchlist`, { mediaId: 'movie:1' }], ['DELETE', `/api/profiles/${id}/watchlist`, { mediaId: 'movie:1' }],
      ['POST', `/api/profiles/${id}/favorites`, { mediaId: 'movie:1' }], ['DELETE', `/api/profiles/${id}/favorites`, { mediaId: 'movie:1' }],
      ['POST', `/api/profiles/${id}/history`, { mediaId: 'movie:1', positionSeconds: 1, durationSeconds: 9 }],
      ['DELETE', `/api/profiles/${id}/history`, { mediaId: 'movie:1' }], ['POST', '/api/recommendations', {}],
    ];
    for (const [label, client] of [['no cookie', anon], ['garbage cookie', garbage], ['wrong-secret JWT', wrongSecret]] as const) {
      for (const [method, path, json] of calls) {
        const res = await client.request(path, { method, json });
        assert.equal(res.status, 401, `${label}: ${method} ${path} returned ${res.status}`);
      }
      const page = await client.request('/profiles');
      assert.equal(page.status, 307, `${label}: /profiles must redirect`);
    }
    const stillThere = (await aliceClient.json('/api/profiles')).body.profiles.find((p: any) => p.id === id);
    assert.ok(stillThere, 'unauthorized calls must not have changed Alice\'s data');
  });

  it('isolates data between users (no leaks, no IDOR)', async () => {
    const bobProfile = await bobClient.json('/api/profiles', { method: 'POST', json: profile('BobOwn') });
    assert.equal(bobProfile.status, 201);
    const list = await bobClient.json('/api/profiles');
    const blob = JSON.stringify(list.body);
    for (const secret of [aliceProfileId, 'AlicePrivate', 'movie:550', 'tv:1399']) assert.equal(blob.includes(secret), false, `Bob's data leaked ${secret}`);
    const id = aliceProfileId;
    const attempts: [string, string, unknown?][] = [
      ['PATCH', `/api/profiles/${id}`, { name: 'Hacked' }], ['DELETE', `/api/profiles/${id}`],
      ['POST', `/api/profiles/${id}/watchlist`, { mediaId: 'movie:1' }], ['DELETE', `/api/profiles/${id}/watchlist`, { mediaId: 'movie:550' }],
      ['POST', `/api/profiles/${id}/favorites`, { mediaId: 'movie:1' }], ['DELETE', `/api/profiles/${id}/favorites`, { mediaId: 'tv:1399' }],
      ['POST', `/api/profiles/${id}/history`, { mediaId: 'movie:1', positionSeconds: 1, durationSeconds: 9 }],
      ['DELETE', `/api/profiles/${id}/history`, { mediaId: 'movie:1' }], ['PUT', '/api/profiles/selected', { profileId: id }],
      ['POST', '/api/recommendations', { profileId: id }],
    ];
    for (const [method, path, json] of attempts) {
      const res = await bobClient.request(path, { method, json });
      assert.ok([404, 409].includes(res.status), `${method} ${path} returned ${res.status}`);
      if (res.status === 409) assert.match(path, /history/, 'only the disabled-playback gate may answer 409');
    }
    const mine = (await aliceClient.json('/api/profiles')).body.profiles.find((p: any) => p.id === id);
    assert.equal(mine.name, 'AlicePrivate');
    assert.deepEqual(mine.watchlist, ['movie:550']);
    assert.deepEqual(mine.favorites, ['tv:1399']);
  });

  it('keeps authorized playback disabled by default (409)', async () => {
    const res = await aliceClient.json(`/api/profiles/${aliceProfileId}/history`, { method: 'POST', json: { mediaId: 'movie:550', positionSeconds: 10, durationSeconds: 100 } });
    assert.equal(res.status, 409);
  });

  it('invalidates the session server-side on logout (a stolen cookie stops working)', async () => {
    const victim = new Client();
    await victim.login(alice.email, alice.password);
    const stolen = victim.cookieHeader();
    assert.equal((await victim.json('/api/profiles')).status, 200);

    const thief = new Client();
    for (const pair of stolen.split('; ')) { const i = pair.indexOf('='); thief.cookies.set(pair.slice(0, i), pair.slice(i + 1)); }
    assert.equal((await thief.json('/api/profiles')).status, 200, 'copied cookie works before logout');

    await victim.logout();
    assert.equal((await victim.json('/api/profiles')).status, 401);
    const replay = await thief.json('/api/profiles');
    assert.equal(replay.status, 401, 'replayed cookie must be rejected after logout');
    assert.deepEqual((await thief.json('/api/auth/session')).body, {}, 'session endpoint must not report a revoked session');
    assert.equal((await aliceClient.json('/api/profiles')).status, 200, 'other sessions of the same user stay valid');
  });

  it('answers 429 with Retry-After after repeated failed logins, even for the right password', async () => {
    const target = user('lockout');
    await anon.json('/api/auth/register', { method: 'POST', json: target });
    const victim = new Client();
    for (let i = 0; i < 5; i++) {
      const res = await victim.login(target.email, `Wrong-Password-${i}x`);
      assert.notEqual(res.status, 429, `attempt ${i + 1} must still be a normal failure`);
      assert.equal(res.headers.getSetCookie().some((c) => /session-token=[^;]/.test(c)), false);
    }
    const locked = await victim.login(target.email, target.password);
    assert.equal(locked.status, 429);
    assert.ok(Number(locked.headers.get('retry-after')) > 0, 'Retry-After header expected');
    assert.equal(locked.headers.getSetCookie().some((c) => /session-token=[^;]/.test(c)), false, 'no session while locked');
    const other = new Client();
    const ok = await other.login(alice.email, alice.password);
    assert.notEqual(ok.status, 429, 'other accounts are unaffected');
    assert.equal((await other.json('/api/profiles')).status, 200);
  });

  it('answers 429 after repeated failed registrations from the same source', async () => {
    const dup = user('dup');
    assert.equal((await anon.json('/api/auth/register', { method: 'POST', json: dup })).status, 201);
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) statuses.push((await anon.json('/api/auth/register', { method: 'POST', json: dup })).status);
    assert.ok(statuses.includes(429), `expected a 429 in ${statuses.join(',')}`);
    assert.equal(statuses[0], 409);
  });

  it('cannot bypass the lockout by rotating X-Forwarded-For', async () => {
    const target = user('rotate');
    await anon.json('/api/auth/register', { method: 'POST', json: target });
    let locked = false;
    for (let i = 0; i < 40 && !locked; i++) {
      const c = new Client();
      c.extraHeaders['x-forwarded-for'] = `203.0.113.${i + 1}`;
      locked = (await c.login(target.email, `Wrong-Password-${i}x`)).status === 429;
    }
    assert.ok(locked, 'per-account failure cap must trigger regardless of claimed client IP');
    const c = new Client();
    c.extraHeaders['x-forwarded-for'] = '198.51.100.77';
    assert.equal((await c.login(target.email, target.password)).status, 429, 'correct password still blocked while locked');
  });
});
