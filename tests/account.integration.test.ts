/* eslint-disable @typescript-eslint/no-explicit-any -- JSON response bodies in black-box API tests */
// Account management (/api/account/*), tested through the real HTTP API of a running server backed by an ISOLATED database.
//   E2E_BASE_URL=http://localhost:4101 npx tsx --test tests/account.integration.test.ts
// Skipped unless E2E_BASE_URL is set. It registers, changes and DELETES test accounts: never point it at real data.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const BASE = process.env.E2E_BASE_URL;

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
    const res = await fetch(`${BASE}${path}`, { ...init, headers, body, redirect: 'manual' });
    for (const raw of res.headers.getSetCookie()) {
      const [pair] = raw.split(';');
      const i = pair.indexOf('=');
      const name = pair.slice(0, i);
      const value = pair.slice(i + 1);
      if (!value || /max-age=0/i.test(raw) || /expires=thu, 01 jan 1970/i.test(raw)) this.cookies.delete(name);
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

  async signedIn() {
    return (await this.json('/api/auth/session')).body?.user ? true : false;
  }
}

const run = Date.now();
const PASSWORD = 'Correct-Horse-Battery-9';
const NEW_PASSWORD = 'Another-Strong-Pass-42';
const WRONG = 'Wrong-Password-123';

async function account(tag: string) {
  const email = `cineverse-e2e-account-${tag}+${run}@example.com`;
  assert.equal((await new Client().json('/api/auth/register', { method: 'POST', json: { name: `Account ${tag}`, email, password: PASSWORD } })).status, 201);
  const client = new Client();
  await client.login(email, PASSWORD);
  assert.equal(await client.signedIn(), true, 'signed in');
  return { client, email };
}

const profile = (client: Client, name: string, pin: string) =>
  client.json('/api/profiles', { method: 'POST', json: { name, avatar: 'ember', isKids: false, maturityLevel: 18, preferences: ['Action'], language: 'fr-FR', pin, confirmPin: pin } });

describe('Account management (isolated database)', { skip: !BASE }, () => {
  it('every account endpoint refuses anonymous requests, and the page redirects to the login', async () => {
    const anon = new Client();
    const calls: [string, string, unknown?][] = [
      ['GET', '/api/account'], ['PATCH', '/api/account', { name: 'Hacker' }], ['DELETE', '/api/account', { password: PASSWORD, confirmation: 'SUPPRIMER' }],
      ['POST', '/api/account/password', { currentPassword: PASSWORD, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD }],
      ['DELETE', '/api/account/sessions', { scope: 'all' }], ['POST', '/api/account/export', { password: PASSWORD }],
    ];
    for (const [method, path, json] of calls) assert.equal((await anon.json(path, { method, json })).status, 401, `${method} ${path}`);
    const page = await anon.request('/account');
    assert.equal(page.status, 307);
    assert.match(page.headers.get('location') ?? '', /\/login/);
  });

  it('returns the real account data, profile summary and sessions, with no secrets', async () => {
    const { client, email } = await account('read');
    await profile(client, 'Alex', '7392');
    const kids = await client.json('/api/profiles', { method: 'POST', json: { name: 'Mini', avatar: 'mint', isKids: true, maturityLevel: 10, preferences: [], language: 'fr-FR', parentalPin: '4821', pin: '5038', confirmPin: '5038' } });
    assert.equal(kids.status, 201);
    const res = await client.json('/api/account');
    assert.equal(res.status, 200);
    assert.equal(res.body.account.email, email);
    assert.equal(res.body.account.name, 'Account read');
    assert.ok(!Number.isNaN(Date.parse(res.body.account.createdAt)));
    assert.deepEqual(res.body.profiles.map((p: any) => [p.name, p.isKids, p.hasPin]), [['Alex', false, true], ['Mini', true, true]]);
    assert.equal(res.body.sessions.length, 1);
    assert.equal(res.body.sessions[0].current, true);
    for (const forbidden of ['passwordHash', 'PinHash', 'sessionToken', '$2b$', '$2a$']) assert.equal(res.text.includes(forbidden), false, `no ${forbidden} in the response`);
    assert.match(res.headers.get('cache-control') ?? '', /no-store/);
  });

  it('updates only the name; the e-mail and other fields cannot be changed (no mass assignment)', async () => {
    const { client, email } = await account('name');
    assert.equal((await client.json('/api/account', { method: 'PATCH', json: { name: '  Nouveau Nom ' } })).body.name, 'Nouveau Nom');
    assert.equal((await client.json('/api/account')).body.account.name, 'Nouveau Nom', 'persisted');
    for (const bad of [{ name: 'A' }, { name: '' }, { name: 'x'.repeat(61) }, {}, { name: 'Alex', email: 'stolen@example.com' }, { name: 'Alex', passwordHash: 'x' }, { name: 'Alex', id: 'other' }, { name: 123 }]) {
      assert.equal((await client.json('/api/account', { method: 'PATCH', json: bad })).status, 400, JSON.stringify(bad));
    }
    const after = (await client.json('/api/account')).body.account;
    assert.equal(after.email, email, 'e-mail unchanged');
    assert.equal(after.name, 'Nouveau Nom');
  });

  it('refuses cross-site and non-JSON mutations (CSRF defence)', async () => {
    const { client } = await account('csrf');
    const evil = await client.json('/api/account', { method: 'PATCH', json: { name: 'Pwned' }, headers: { origin: 'https://evil.example' } });
    assert.equal(evil.status, 403);
    assert.equal(evil.body.code, 'CROSS_SITE');
    assert.equal((await client.json('/api/account', { method: 'PATCH', json: { name: 'Pwned' }, headers: { 'sec-fetch-site': 'cross-site' } })).status, 403);
    const form = await client.json('/api/account', { method: 'PATCH', headers: { 'content-type': 'text/plain' }, body: JSON.stringify({ name: 'Pwned' }) });
    assert.equal(form.status, 415);
    assert.equal((await client.json('/api/account')).body.account.name, 'Account csrf', 'nothing changed');
    const sameOrigin = await client.json('/api/account', { method: 'PATCH', json: { name: 'Same Origin' }, headers: { origin: BASE! } });
    assert.equal(sameOrigin.status, 200);
  });

  it('password change: validates precisely, verifies the current password, keeps this session, closes the others', async () => {
    const { client, email } = await account('password');
    const other = new Client();
    await other.login(email, PASSWORD);
    assert.equal(await other.signedIn(), true, 'second device signed in');
    assert.equal((await client.json('/api/account')).body.sessions.length, 2);

    const change = (json: object) => client.json('/api/account/password', { method: 'POST', json });
    const base = { currentPassword: PASSWORD, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD };
    assert.equal((await change({ ...base, currentPassword: '' })).body.code, 'PASSWORD_REQUIRED', 'empty current password');
    const weak = await change({ ...base, newPassword: 'short', confirmPassword: 'short' });
    assert.equal(weak.status, 400);
    assert.match(weak.body.error, /12 caractères/);
    assert.match((await change({ ...base, confirmPassword: 'Different-Pass-42x' })).body.error, /confirmation/);
    assert.match((await change({ ...base, newPassword: PASSWORD, confirmPassword: PASSWORD })).body.error, /différent/);
    assert.equal((await change({ ...base, email: 'x@example.com' })).status, 400, 'unknown field refused');
    const wrong = await change({ ...base, currentPassword: WRONG });
    assert.equal(wrong.status, 403);
    assert.equal(wrong.body.code, 'PASSWORD_INCORRECT');
    assert.equal(await other.signedIn(), true, 'failed attempts changed nothing');

    const ok = await change(base);
    assert.equal(ok.status, 200);
    assert.equal(ok.body.otherSessionsRevoked, 1);
    assert.equal(ok.text.includes(NEW_PASSWORD), false, 'the password is never echoed');
    assert.equal(await client.signedIn(), true, 'the current session stays signed in');
    assert.equal(await other.signedIn(), false, 'the other session was revoked');
    assert.equal((await client.json('/api/account')).body.sessions.length, 1);

    const oldLogin = new Client();
    await oldLogin.login(email, PASSWORD);
    assert.equal(await oldLogin.signedIn(), false, 'the old password no longer works');
    const newLogin = new Client();
    await newLogin.login(email, NEW_PASSWORD);
    assert.equal(await newLogin.signedIn(), true, 'the new password works');
  });

  it('repeated wrong current passwords lock the sensitive operations (shared rate limit)', async () => {
    const { client } = await account('ratelimit');
    const attempt = () => client.json('/api/account/password', { method: 'POST', json: { currentPassword: WRONG, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD } });
    for (let i = 0; i < 5; i++) assert.equal((await attempt()).status, 403, `attempt ${i + 1}`);
    const locked = await attempt();
    assert.equal(locked.status, 429);
    assert.ok(Number(locked.headers.get('retry-after')) > 0);
    const right = await client.json('/api/account/password', { method: 'POST', json: { currentPassword: PASSWORD, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD } });
    assert.equal(right.status, 429, 'the right password does not bypass the lockout');
    assert.equal((await client.json('/api/account/export', { method: 'POST', json: { password: PASSWORD } })).status, 429, 'export shares the same protection');
  });

  it('lists sessions and revokes one, the others, or all; the current session is protected from single revocation', async () => {
    const { client, email } = await account('sessions');
    const second = new Client(); await second.login(email, PASSWORD);
    const third = new Client(); await third.login(email, PASSWORD);
    const list = (await client.json('/api/account')).body.sessions;
    assert.equal(list.length, 3);
    const mine = list.find((s: any) => s.current);
    const secondId = list.find((s: any) => !s.current).id;
    assert.equal(list.filter((s: any) => s.current).length, 1);

    assert.equal((await client.json('/api/account/sessions', { method: 'DELETE', json: { sessionId: mine.id } })).status, 400, 'use sign out for the current session');
    assert.equal(await client.signedIn(), true);
    assert.equal((await client.json('/api/account/sessions', { method: 'DELETE', json: { sessionId: 'does-not-exist' } })).status, 404);
    assert.equal((await client.json('/api/account/sessions', { method: 'DELETE', json: { scope: 'everyone' } })).status, 400);

    assert.equal((await client.json('/api/account/sessions', { method: 'DELETE', json: { sessionId: secondId } })).status, 200);
    const stillOpen = [await second.signedIn(), await third.signedIn()];
    assert.equal(stillOpen.filter(Boolean).length, 1, 'exactly one of the two other devices was closed');

    const others = await client.json('/api/account/sessions', { method: 'DELETE', json: { scope: 'others' } });
    assert.equal(others.body.revoked, 1);
    assert.equal(await second.signedIn() || await third.signedIn(), false);
    assert.equal(await client.signedIn(), true, 'this device stays signed in');

    const all = await client.json('/api/account/sessions', { method: 'DELETE', json: { scope: 'all' } });
    assert.equal(all.body.signedOut, true);
    assert.equal(await client.signedIn(), false, 'signed out everywhere');
  });

  it('one account cannot see, revoke or change another account’s data', async () => {
    const alice = await account('alice');
    const bob = await account('bob');
    await profile(alice.client, 'AliceProfile', '7392');
    const aliceSessionId = (await alice.client.json('/api/account')).body.sessions[0].id;

    const bobView = (await bob.client.json('/api/account')).body;
    assert.equal(bobView.account.email, bob.email);
    assert.deepEqual(bobView.profiles, [], 'Bob sees none of Alice’s profiles');
    assert.equal(JSON.stringify(bobView).includes(aliceSessionId), false);

    assert.equal((await bob.client.json('/api/account/sessions', { method: 'DELETE', json: { sessionId: aliceSessionId } })).status, 404, 'cannot revoke her session');
    assert.equal(await alice.client.signedIn(), true, 'Alice is still signed in');
    // there is no id in any account URL or body, so URL tampering has nothing to change
    assert.equal((await bob.client.json(`/api/account?userId=${encodeURIComponent(alice.email)}`)).body.account.email, bob.email);
    assert.equal((await bob.client.json('/api/account', { method: 'PATCH', json: { name: 'Bob New' } })).status, 200);
    assert.equal((await alice.client.json('/api/account')).body.account.name, 'Account alice', 'Alice’s name untouched');
  });

  it('keeps profile management protected by the account password and profile PINs', async () => {
    const { client } = await account('profiles');
    const created = await profile(client, 'Alex', '7392');
    const id = created.body.profile.id;
    assert.equal((await client.json(`/api/profiles/${id}`, { method: 'DELETE', json: {} })).body.code, 'PASSWORD_REQUIRED');
    assert.equal((await client.json(`/api/profiles/${id}`, { method: 'DELETE', json: { password: WRONG } })).status, 403);
    assert.equal((await client.json(`/api/profiles/${id}/watchlist`, { method: 'POST', json: { mediaId: 'movie:550' } })).status, 403, 'still locked behind the PIN');
    const summary = (await client.json('/api/account')).body;
    assert.equal(summary.profiles.length, 1, 'the account page never needed an unlock, and nothing was deleted');
  });

  it('exports the account’s data only after the password, without any hash or token', async () => {
    const { client, email } = await account('export');
    const created = await profile(client, 'Alex', '7392');
    const id = created.body.profile.id;
    await client.json(`/api/profiles/${id}/unlock`, { method: 'POST', json: { pin: '7392' } });
    await client.json(`/api/profiles/${id}/watchlist`, { method: 'POST', json: { mediaId: 'movie:550' } });
    assert.equal((await client.json('/api/account/export', { method: 'POST', json: {} })).body.code, 'PASSWORD_REQUIRED');
    assert.equal((await client.json('/api/account/export', { method: 'POST', json: { password: WRONG } })).status, 403);
    const res = await client.json('/api/account/export', { method: 'POST', json: { password: PASSWORD } });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-disposition') ?? '', /attachment/);
    assert.equal(res.body.account.email, email);
    assert.deepEqual(res.body.profiles[0].watchlist.map((w: any) => w.mediaId), ['movie:550']);
    assert.equal(res.body.profiles[0].pinProtected, true);
    for (const forbidden of ['passwordHash', 'profilePinHash', 'parentalPinHash', 'sessionToken', '$2b$', '$2a$']) assert.equal(res.text.includes(forbidden), false, `no ${forbidden} in the export`);
  });

  it('deletes only the signed-in account, after password and confirmation, and cascades its data', async () => {
    const victim = await account('delete');
    const bystander = await account('bystander');
    await profile(victim.client, 'Alex', '7392');
    await profile(bystander.client, 'Keep', '5038');
    const del = (json: object) => victim.client.json('/api/account', { method: 'DELETE', json });
    assert.equal((await del({})).body.code, 'PASSWORD_REQUIRED');
    assert.equal((await del({ password: PASSWORD })).body.code, 'CONFIRMATION_REQUIRED');
    assert.equal((await del({ password: PASSWORD, confirmation: 'supprimer' })).body.code, 'CONFIRMATION_REQUIRED');
    const wrong = await del({ password: WRONG, confirmation: 'SUPPRIMER' });
    assert.equal(wrong.status, 403);
    assert.equal(wrong.body.code, 'PASSWORD_INCORRECT');
    assert.equal((await victim.client.json('/api/account')).status, 200, 'refused attempts deleted nothing');
    assert.equal((await del({ password: PASSWORD, confirmation: 'SUPPRIMER', userId: bystander.email })).status, 400, 'no way to name another account');

    assert.equal((await del({ password: PASSWORD, confirmation: 'SUPPRIMER' })).status, 200);
    assert.equal(await victim.client.signedIn(), false, 'the session died with the account');
    const relogin = new Client();
    await relogin.login(victim.email, PASSWORD);
    assert.equal(await relogin.signedIn(), false, 'the account no longer exists');

    const kept = (await bystander.client.json('/api/account')).body;
    assert.equal(kept.profiles.length, 1, 'another account’s profiles are untouched');
    assert.equal(kept.profiles[0].name, 'Keep');
  });
});
