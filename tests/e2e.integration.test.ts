/* eslint-disable @typescript-eslint/no-explicit-any -- JSON response bodies in black-box API tests */
// End-to-end API flows against a running server backed by an ISOLATED test database.
// Run: E2E_BASE_URL=http://localhost:4100 npx tsx --test tests/e2e.integration.test.ts
// Skipped unless E2E_BASE_URL is set. Never point this at a database you care about.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const BASE = process.env.E2E_BASE_URL;

class Client {
  private cookies = new Map<string, string>();

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
      if (!value || /expires=thu, 01 jan 1970/i.test(raw)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    return res;
  }

  async json(path: string, init: RequestInit & { json?: unknown } = {}) {
    const res = await this.request(path, init);
    return { status: res.status, body: (await res.json().catch(() => null)) as any };
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

  adopt(other: Client) {
    this.cookies = new Map(other.cookies);
  }

  session() {
    return this.json('/api/auth/session');
  }
}

const run = Date.now();
const PASSWORD = 'Correct-Horse-Battery-9';
export const E2E_EMAIL_PREFIX = 'cineverse-e2e-';
const userA = { name: 'Alice Test', email: `${E2E_EMAIL_PREFIX}alice+${run}@example.com`, password: PASSWORD };
const userB = { name: 'Bob Test', email: `${E2E_EMAIL_PREFIX}bob+${run}@example.com`, password: PASSWORD };
const ADULT_MOVIE = 'movie:293660'; // Deadpool (R-rated) - must be refused for kids profiles
const FAMILY_MOVIE = 'movie:862'; // Toy Story
const ADULT_PIN = '7392';
const KIDS_PIN = '4821';

describe('CINEVERSE end-to-end (isolated database)', { skip: !BASE }, () => {
  const alice = new Client();
  const bob = new Client();
  const anon = new Client();
  let adultId = '';
  let kidsId = '';
  let bobProfileId = '';

  it('rejects weak registration data', async () => {
    const res = await anon.json('/api/auth/register', { method: 'POST', json: { ...userA, password: 'short' } });
    assert.equal(res.status, 400);
  });

  it('registers users and rejects duplicates', async () => {
    assert.equal((await anon.json('/api/auth/register', { method: 'POST', json: userA })).status, 201);
    assert.equal((await anon.json('/api/auth/register', { method: 'POST', json: userB })).status, 201);
    assert.equal((await anon.json('/api/auth/register', { method: 'POST', json: userA })).status, 409);
  });

  it('protects private APIs and pages for anonymous visitors', async () => {
    assert.equal((await anon.json('/api/profiles')).status, 401);
    assert.equal((await anon.json('/api/recommendations', { method: 'POST', json: {} })).status, 401);
    const page = await anon.request('/my-list');
    assert.equal(page.status, 307);
    assert.match(page.headers.get('location') ?? '', /\/login/);
  });

  it('rejects invalid login and leaves no session', async () => {
    const bad = new Client();
    await bad.login(userA.email, 'Wrong-Password-123');
    assert.deepEqual((await bad.session()).body, {});
    assert.equal((await bad.json('/api/profiles')).status, 401);
    const unknown = new Client();
    await unknown.login(`nobody+${run}@example.com`, PASSWORD);
    assert.deepEqual((await unknown.session()).body, {});
  });

  it('logs in and issues an HttpOnly session cookie', async () => {
    const res = await alice.login(userA.email, userA.password);
    const cookie = res.headers.getSetCookie().find((c) => c.includes('next-auth.session-token')) ?? '';
    assert.match(cookie, /HttpOnly/i);
    const session = (await alice.session()).body;
    assert.equal(session.user.email, userA.email);
    assert.ok(session.user.id);
    await bob.login(userB.email, userB.password);
    assert.equal((await bob.session()).body.user.email, userB.email);
  });

  // Every profile has its own PIN; using a profile means unlocking it first (one unlocked profile per login session).
  const unlock = async (client: Client, profileId: string, pin: string) => {
    const res = await client.json(`/api/profiles/${profileId}/unlock`, { method: 'POST', json: { pin } });
    assert.equal(res.status, 200, `unlocking ${profileId} returned ${res.status}`);
    return res;
  };

  it('creates profiles (PIN required), lists them locked, and edits only with the account password', async () => {
    const base = { name: 'Alice', avatar: 'avatar-1', isKids: false, maturityLevel: 18, preferences: ['Action'], language: 'fr-FR' };
    assert.equal((await alice.json('/api/profiles', { method: 'POST', json: base })).status, 400, 'a profile without a PIN is refused');
    assert.equal((await alice.json('/api/profiles', { method: 'POST', json: { ...base, pin: '1234', confirmPin: '1234' } })).status, 400, 'weak PIN refused');
    assert.equal((await alice.json('/api/profiles', { method: 'POST', json: { ...base, pin: '7392', confirmPin: '7391' } })).status, 400, 'mismatched confirmation refused');

    const created = await alice.json('/api/profiles', { method: 'POST', json: { ...base, pin: ADULT_PIN, confirmPin: ADULT_PIN } });
    assert.equal(created.status, 201);
    adultId = created.body.profile.id;
    assert.equal(created.body.profile.locked, true);
    assert.equal(created.body.profile.hasPin, true);
    assert.equal(JSON.stringify(created.body).includes('PinHash'), false, 'no hash is ever sent to the browser');
    assert.equal(JSON.stringify(created.body).includes(ADULT_PIN), false, 'the PIN is never echoed');

    const noParental = await alice.json('/api/profiles', {
      method: 'POST',
      json: { name: 'Junior', avatar: 'avatar-2', isKids: true, maturityLevel: 7, preferences: [], language: 'fr-FR', pin: KIDS_PIN, confirmPin: KIDS_PIN },
    });
    assert.equal(noParental.status, 400);

    const kids = await alice.json('/api/profiles', {
      method: 'POST',
      json: { name: 'Junior', avatar: 'avatar-2', isKids: true, maturityLevel: 7, preferences: [], language: 'fr-FR', parentalPin: '1234', pin: KIDS_PIN, confirmPin: KIDS_PIN },
    });
    assert.equal(kids.status, 201);
    kidsId = kids.body.profile.id;
    assert.equal(JSON.stringify(kids.body).includes('parentalPinHash'), false);

    await unlock(alice, adultId, ADULT_PIN);
    const noPassword = await alice.json(`/api/profiles/${adultId}`, { method: 'PATCH', json: { name: 'Alicia' } });
    assert.equal(noPassword.status, 400, 'editing needs the account password');
    const wrongPassword = await alice.json(`/api/profiles/${adultId}`, { method: 'PATCH', json: { name: 'Alicia', password: 'Wrong-Password-123' } });
    assert.equal(wrongPassword.status, 403);
    const renamed = await alice.json(`/api/profiles/${adultId}`, { method: 'PATCH', json: { name: 'Alicia', avatar: 'avatar-3', preferences: ['Drame'], password: PASSWORD } });
    assert.equal(renamed.status, 200);
    assert.equal(renamed.body.profile.name, 'Alicia');
    assert.equal(renamed.body.profile.avatar, 'avatar-3');

    // only the unlocked profile shows its personal data and counts as selected
    const listed = await alice.json('/api/profiles');
    assert.equal(listed.body.profiles.length, 2);
    assert.equal(listed.body.selectedProfileId, adultId);
    assert.deepEqual(listed.body.profiles.find((p: any) => p.id === adultId).preferences, ['Drame']);
    const lockedKids = listed.body.profiles.find((p: any) => p.id === kidsId);
    assert.equal(lockedKids.locked, true);
    assert.deepEqual([lockedKids.watchlist, lockedKids.favorites, lockedKids.history, lockedKids.preferences], [[], [], [], []]);

    // selecting needs the unlock: kids is locked right now
    assert.equal((await alice.json('/api/profiles/selected', { method: 'PUT', json: { profileId: kidsId } })).status, 403);
    await unlock(alice, kidsId, KIDS_PIN);
    assert.equal((await alice.json('/api/profiles')).body.selectedProfileId, kidsId);
  });

  it('persists watchlist and favorites per profile with movie/tv separation', async () => {
    await unlock(alice, adultId, ADULT_PIN);
    const add = (kind: string, mediaId: string, pid = adultId) => alice.json(`/api/profiles/${pid}/${kind}`, { method: 'POST', json: { mediaId } });
    assert.equal((await add('watchlist', 'movie:550')).status, 200);
    assert.equal((await add('watchlist', 'tv:550')).status, 200);
    assert.equal((await add('watchlist', 'movie:550')).status, 200); // idempotent
    assert.equal((await add('favorites', 'movie:550')).status, 200);

    // A "refresh": a brand-new login session sees the same data once the profile is unlocked there.
    const fresh = new Client();
    await fresh.login(userA.email, userA.password);
    const lockedView = (await fresh.json('/api/profiles')).body.profiles.find((x: any) => x.id === adultId);
    assert.deepEqual(lockedView.watchlist, [], 'a new session sees nothing until the PIN is entered');
    await unlock(fresh, adultId, ADULT_PIN);
    const p = (await fresh.json('/api/profiles')).body.profiles.find((x: any) => x.id === adultId);
    assert.deepEqual([...p.watchlist].sort(), ['movie:550', 'tv:550']);
    assert.deepEqual(p.favorites, ['movie:550']);

    assert.equal((await alice.json(`/api/profiles/${adultId}/watchlist`, { method: 'DELETE', json: { mediaId: 'tv:550' } })).status, 200);
    assert.equal((await alice.json(`/api/profiles/${adultId}/favorites`, { method: 'DELETE', json: { mediaId: 'movie:550' } })).status, 200);
    const after = (await alice.json('/api/profiles')).body.profiles.find((x: any) => x.id === adultId);
    assert.deepEqual(after.watchlist, ['movie:550']);
    assert.deepEqual(after.favorites, []);
  });

  it('rejects malformed media identifiers', async () => {
    assert.equal((await alice.json(`/api/profiles/${adultId}/watchlist`, { method: 'POST', json: { mediaId: 'movie:abc' } })).status, 400);
    assert.equal((await alice.json(`/api/profiles/${adultId}/watchlist`, { method: 'POST', json: { mediaId: "x'; drop table" } })).status, 400);
  });

  it('records and removes viewing history and playback progress', async () => {
    const post = (body: object) => alice.json(`/api/profiles/${adultId}/history`, { method: 'POST', json: body });
    assert.equal((await post({ mediaId: 'movie:550', positionSeconds: 100, durationSeconds: 8000 })).status, 200);
    assert.equal((await post({ mediaId: 'movie:550', positionSeconds: 9000, durationSeconds: 8000 })).status, 400);
    const done = await post({ mediaId: 'tv:1399', seasonNumber: 1, episodeNumber: 2, positionSeconds: 2900, durationSeconds: 3000 });
    assert.equal(done.body.completed, true);
    await post({ mediaId: 'tv:1399', seasonNumber: 1, episodeNumber: 3, positionSeconds: 10, durationSeconds: 3000 });

    const history = (await alice.json('/api/profiles')).body.profiles.find((x: any) => x.id === adultId).history;
    assert.equal(history.filter((h: any) => h.mediaId === 'tv:1399').length, 2); // distinct episodes
    assert.ok(history.some((h: any) => h.mediaId === 'movie:550' && h.positionSeconds === 100));

    assert.equal((await alice.json(`/api/profiles/${adultId}/history`, { method: 'DELETE', json: { mediaId: 'movie:550' } })).status, 200);
    const left = (await alice.json('/api/profiles')).body.profiles.find((x: any) => x.id === adultId).history;
    assert.equal(left.some((h: any) => h.mediaId === 'movie:550'), false);
  });

  it('enforces profile ownership for another authenticated user', async () => {
    const created = await bob.json('/api/profiles', {
      method: 'POST',
      json: { name: 'Bob', avatar: 'avatar-1', isKids: false, maturityLevel: 18, preferences: [], language: 'fr-FR', pin: '5038', confirmPin: '5038' },
    });
    bobProfileId = created.body.profile.id;
    await unlock(bob, bobProfileId, '5038');

    assert.equal((await bob.json(`/api/profiles/${adultId}`, { method: 'PATCH', json: { name: 'Hacked', password: PASSWORD } })).status, 404);
    assert.equal((await bob.json(`/api/profiles/${adultId}`, { method: 'DELETE', json: { password: PASSWORD } })).status, 404);
    assert.equal((await bob.json(`/api/profiles/${adultId}/unlock`, { method: 'POST', json: { pin: ADULT_PIN } })).status, 404, "even the right PIN cannot unlock someone else's profile");
    assert.equal((await bob.json(`/api/profiles/${adultId}/pin`, { method: 'PUT', json: { pin: '7392', confirmPin: '7392', password: PASSWORD } })).status, 404);
    assert.equal((await bob.json(`/api/profiles/${adultId}/watchlist`, { method: 'POST', json: { mediaId: 'movie:1' } })).status, 404);
    assert.equal((await bob.json(`/api/profiles/${adultId}/favorites`, { method: 'POST', json: { mediaId: 'movie:1' } })).status, 404);
    assert.equal((await bob.json(`/api/profiles/${adultId}/history`, { method: 'POST', json: { mediaId: 'movie:1', positionSeconds: 1, durationSeconds: 10 } })).status, 404);
    assert.equal((await bob.json('/api/profiles/selected', { method: 'PUT', json: { profileId: adultId } })).status, 404);
    assert.equal((await bob.json('/api/recommendations', { method: 'POST', json: { profileId: adultId } })).status, 404);

    const bobsView = (await bob.json('/api/profiles')).body.profiles;
    assert.deepEqual(bobsView.map((p: any) => p.id), [bobProfileId]);
    await unlock(alice, adultId, ADULT_PIN);
    const aliceStill = (await alice.json('/api/profiles')).body.profiles.find((x: any) => x.id === adultId);
    assert.equal(aliceStill.name, 'Alicia');
  });

  it('ignores client-supplied identity headers', async () => {
    const res = await anon.json('/api/profiles', { headers: { 'x-cineverse-user-id': 'demo-user' } });
    assert.equal(res.status, 401);
  });

  it('enforces kids restrictions and parental PIN on the server', async () => {
    await unlock(alice, kidsId, KIDS_PIN);
    const blocked = await alice.json(`/api/profiles/${kidsId}/watchlist`, { method: 'POST', json: { mediaId: ADULT_MOVIE } });
    assert.equal(blocked.status, 403);
    const allowedFav = await alice.json(`/api/profiles/${kidsId}/favorites`, { method: 'POST', json: { mediaId: ADULT_MOVIE } });
    assert.equal(allowedFav.status, 403);
    const ok = await alice.json(`/api/profiles/${kidsId}/watchlist`, { method: 'POST', json: { mediaId: FAMILY_MOVIE } });
    assert.equal(ok.status, 200);

    const parental = (json: object) => alice.json(`/api/profiles/${kidsId}`, { method: 'PATCH', json: { isKids: false, maturityLevel: 18, password: PASSWORD, ...json } });
    assert.equal((await parental({})).status, 403, 'lifting restrictions needs the parental PIN even with the account password');
    assert.equal((await parental({ parentalPin: '0000' })).status, 403);
    assert.equal((await alice.json(`/api/profiles/${kidsId}`, { method: 'DELETE', json: { password: PASSWORD } })).status, 403);
  });

  it('serves recommendations for the unlocked profile only', async () => {
    await unlock(alice, adultId, ADULT_PIN);
    const res = await alice.json('/api/recommendations', { method: 'POST', json: { profileId: adultId } });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.recommendations));
    assert.ok(res.body.recommendations.length > 0, 'expected live TMDB recommendations');
    assert.equal((await alice.json('/api/recommendations', { method: 'POST', json: { profileId: kidsId } })).status, 403, 'the kids profile is locked now');
    await unlock(alice, kidsId, KIDS_PIN);
    const kidsRecs = await alice.json('/api/recommendations', { method: 'POST', json: { profileId: kidsId } });
    assert.equal(kidsRecs.status, 200);
    assert.equal(JSON.stringify(kidsRecs.body).includes('"adult":true'), false);
  });

  it('keeps TMDB catalog search working', async () => {
    const res = await alice.json('/api/tmdb/catalog?query=Interstellar');
    assert.equal(res.status, 200);
    assert.ok(JSON.stringify(res.body).includes('Interstellar'));
  });

  it('persists everything after logout and a new login session, behind the PINs', async () => {
    await alice.logout();
    assert.deepEqual((await alice.session()).body, {});
    const again = new Client();
    await again.login(userA.email, userA.password);
    const first = (await again.json('/api/profiles')).body;
    assert.equal(first.selectedProfileId, null, 'a new login session starts with no unlocked profile');
    assert.ok(first.profiles.every((p: any) => p.locked && p.watchlist.length === 0));
    await unlock(again, adultId, ADULT_PIN);
    const adult = (await again.json('/api/profiles')).body.profiles.find((p: any) => p.id === adultId);
    assert.equal(adult.name, 'Alicia');
    assert.deepEqual(adult.preferences, ['Drame']);
    assert.deepEqual(adult.watchlist, ['movie:550']);
    assert.ok(adult.history.some((h: any) => h.mediaId === 'tv:1399'));
    await unlock(again, kidsId, KIDS_PIN);
    const kid = (await again.json('/api/profiles')).body.profiles.find((p: any) => p.id === kidsId);
    assert.equal(kid.isKids, true);
    assert.deepEqual(kid.watchlist, [FAMILY_MOVIE]);
    alice.adopt(again);
  });

  it('deletes profiles (account password, plus the parental PIN for kids) and cascades their data', async () => {
    assert.equal((await alice.json(`/api/profiles/${kidsId}`, { method: 'DELETE', json: { parentalPin: '1234' } })).status, 400, 'password required');
    assert.equal((await alice.json(`/api/profiles/${kidsId}`, { method: 'DELETE', json: { password: PASSWORD, parentalPin: '1234' } })).status, 200);
    assert.equal((await alice.json(`/api/profiles/${adultId}`, { method: 'DELETE', json: { password: PASSWORD } })).status, 200);
    const left = (await alice.json('/api/profiles')).body;
    assert.equal(left.profiles.length, 0);
    assert.equal(left.selectedProfileId, null);
  });

  it('logs out and invalidates API access', async () => {
    await alice.logout();
    assert.deepEqual((await alice.session()).body, {});
    assert.equal((await alice.json('/api/profiles')).status, 401);
  });
});
