/* eslint-disable @typescript-eslint/no-explicit-any -- JSON response bodies in black-box API tests */
// Authentication state on entry: which of "signed out", "signed in", "session expired" and "database unreachable" a request is in,
// and that none of them is ever answered with an empty profile list. Black-box, against a running server on an ISOLATED database.
//   E2E_BASE_URL=http://localhost:4101 [E2E_DB_STOP_COMMAND="bash db-stop.sh" E2E_DB_START_COMMAND="bash db-start.sh"] \
//     npx tsx --test tests/session-state.integration.test.ts
// The two optional commands stop and start the isolated database (not the app) to prove the outage behaviour; without them the
// outage test is skipped.
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { describe, it } from 'node:test';

const BASE = process.env.E2E_BASE_URL;
const STOP = process.env.E2E_DB_STOP_COMMAND;
const START = process.env.E2E_DB_START_COMMAND;

class Client {
  cookies = new Map<string, string>();

  async request(path: string, init: RequestInit & { json?: unknown } = {}) {
    const headers = new Headers(init.headers);
    if (this.cookies.size) headers.set('cookie', [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '));
    let body = init.body;
    if (init.json !== undefined) { headers.set('content-type', 'application/json'); body = JSON.stringify(init.json); }
    const send = () => fetch(`${BASE}${path}`, { ...init, headers, body, redirect: 'manual' });
    const res = await send().catch(() => send());
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
    await this.request('/api/auth/callback/credentials', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ csrfToken: body.csrfToken, email, password, json: 'true' }).toString() });
  }

  async logout() {
    const { body } = await this.json('/api/auth/csrf');
    await this.request('/api/auth/signout', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ csrfToken: body.csrfToken, json: 'true' }).toString() });
  }
}

const run = Date.now();
const PASSWORD = 'Correct-Horse-Battery-9';
const PIN = '4821';
const WRONG_PIN = '1357';
const email = (tag: string) => `cineverse-e2e-session-${tag}+${run}@example.com`;
const state = async (client: Client) => (await client.json('/api/session/state')).body.state as string;

async function member(tag: string) {
  const address = email(tag);
  assert.equal((await new Client().json('/api/auth/register', { method: 'POST', json: { name: `Session ${tag}`, email: address, password: PASSWORD } })).status, 201);
  const client = new Client();
  await client.login(address, PASSWORD);
  return { client, email: address };
}
const addProfile = async (client: Client, name: string) => {
  const created = await client.json('/api/profiles', { method: 'POST', json: { name, avatar: 'ember', isKids: false, maturityLevel: 18, preferences: [], language: 'fr-FR', pin: PIN, confirmPin: PIN } });
  assert.equal(created.status, 201, created.text);
  return created.body.profile.id as string;
};
const names = async (client: Client) => ((await client.json('/api/profiles')).body.profiles as any[]).map((profile) => profile.name);

describe('Authentication state on entry (isolated database)', { skip: !BASE }, () => {
  it('signed out: "/" and every protected page go to the login, the API says 401, and no profile data is returned', async () => {
    const anon = new Client();
    for (const path of ['/', '/profiles', '/my-list', '/account', '/admin/support']) {
      const response = await anon.request(path);
      assert.equal(response.status, 307, path);
      assert.match(response.headers.get('location') ?? '', /\/login\?callbackUrl=/, path);
    }
    assert.equal((await anon.request('/login')).status, 200, 'the login page itself is public');
    assert.equal(await state(anon), 'unauthenticated');
    const profiles = await anon.json('/api/profiles');
    assert.equal(profiles.status, 401);
    assert.equal(profiles.body.profiles, undefined);
  });

  it('a forged or tampered session cookie is not a session', async () => {
    const forged = new Client();
    forged.cookies.set('next-auth.session-token', 'eyJhbGciOiJkaXIifQ.forged.forged.forged.forged');
    assert.equal(await state(forged), 'unauthenticated');
    assert.equal((await forged.request('/')).status, 307);
    assert.equal((await forged.json('/api/profiles')).status, 401);
    const real = await member('tamper');
    const token = real.client.cookies.get('next-auth.session-token') as string;
    const tampered = new Client();
    tampered.cookies.set('next-auth.session-token', `${token.slice(0, -4)}AAAA`);
    assert.equal(await state(tampered), 'unauthenticated');
    assert.equal((await tampered.json('/api/profiles')).status, 401);
  });

  it('signed in without an unlocked profile: the session is authenticated and every profile is returned locked, with nothing selected', async () => {
    const { client } = await member('locked');
    await addProfile(client, 'Manel');
    await addProfile(client, 'Anas');
    assert.equal(await state(client), 'authenticated');
    const list = await client.json('/api/profiles');
    assert.equal(list.status, 200);
    assert.equal(list.body.selectedProfileId, null);
    assert.deepEqual(list.body.profiles.map((profile: any) => profile.name), ['Manel', 'Anas']);
    assert.ok(list.body.profiles.every((profile: any) => profile.locked === true && profile.watchlist.length === 0));
    assert.equal((await client.request('/')).status, 200, 'the page is served (the client then sends the member to /profiles)');
  });

  it('PIN: a wrong code is refused and unlocks nothing; the right one unlocks that profile only', async () => {
    const { client } = await member('pin');
    const first = await addProfile(client, 'Manel');
    const second = await addProfile(client, 'Anas');
    const wrong = await client.json(`/api/profiles/${first}/unlock`, { method: 'POST', json: { pin: WRONG_PIN } });
    assert.equal(wrong.status, 401);
    assert.equal((await client.json('/api/profiles')).body.selectedProfileId, null, 'still nothing unlocked');
    const right = await client.json(`/api/profiles/${first}/unlock`, { method: 'POST', json: { pin: PIN } });
    assert.equal(right.status, 200);
    const after = (await client.json('/api/profiles')).body;
    assert.equal(after.selectedProfileId, first);
    assert.equal(after.profiles.find((profile: any) => profile.id === second).locked, true, 'the other profile stays locked');
  });

  it('an unlock never carries over to another login session or account', async () => {
    const owner = await member('carry');
    const id = await addProfile(owner.client, 'Manel');
    assert.equal((await owner.client.json(`/api/profiles/${id}/unlock`, { method: 'POST', json: { pin: PIN } })).status, 200);
    const again = new Client();
    await again.login(owner.email, PASSWORD);
    assert.equal((await again.json('/api/profiles')).body.selectedProfileId, null, 'a new login starts locked');
    const stranger = await member('stranger');
    stranger.client.cookies.set('cv-unlock', owner.client.cookies.get('cv-unlock') ?? '');
    assert.equal((await stranger.client.json('/api/profiles')).body.selectedProfileId, null);
    assert.equal((await stranger.client.json(`/api/profiles/${id}`)).status === 200, false, 'another account cannot read the profile');
  });

  it('an expired session (signed out elsewhere) is reported as expired, returns no profiles, and deletes nothing', async () => {
    const { client, email: address } = await member('expired');
    await addProfile(client, 'Manel');
    await addProfile(client, 'Anas');
    const stale = new Client();
    stale.cookies = new Map(client.cookies);
    await client.logout();
    assert.equal(await state(stale), 'expired');
    const response = await stale.json('/api/profiles');
    assert.equal(response.status, 401);
    assert.equal(response.body.code, 'SESSION_EXPIRED');
    assert.equal(response.body.profiles, undefined);
    const fresh = new Client();
    await fresh.login(address, PASSWORD);
    assert.deepEqual(await names(fresh), ['Manel', 'Anas'], 'the profiles are exactly as they were');
  });

  it('database unreachable: 503 DATABASE_UNAVAILABLE (never 401 or an empty list); the session and profiles are intact once it is back', { skip: !STOP || !START }, async () => {
    const { client } = await member('outage');
    const id = await addProfile(client, 'Manel');
    await addProfile(client, 'Anas');
    assert.equal((await client.json(`/api/profiles/${id}/unlock`, { method: 'POST', json: { pin: PIN } })).status, 200);
    execSync(STOP!, { stdio: 'ignore' });
    try {
      assert.equal(await state(client), 'unavailable');
      const down = await client.json('/api/profiles');
      assert.equal(down.status, 503);
      assert.equal(down.body.code, 'DATABASE_UNAVAILABLE');
      assert.equal(down.body.profiles, undefined, 'no empty list');
      assert.equal(await state(new Client()), 'unauthenticated', 'a visitor with no cookie needs no database to be recognised');
    } finally {
      execSync(START!, { stdio: 'ignore' });
    }
    assert.equal(await state(client), 'authenticated', 'the same session works again');
    const back = (await client.json('/api/profiles')).body;
    assert.deepEqual(back.profiles.map((profile: any) => profile.name), ['Manel', 'Anas']);
    assert.equal(back.selectedProfileId, id, 'the unlocked profile is still selected');
  });
});
