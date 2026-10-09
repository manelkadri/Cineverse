/* eslint-disable @typescript-eslint/no-explicit-any -- JSON response bodies in black-box API tests */
// Notification center, tested through the real HTTP API of a running server backed by an ISOLATED database.
//   E2E_BASE_URL=http://localhost:4101 E2E_GRANT_ADMIN_COMMAND="bash grant-admin.sh" npx tsx --test tests/notifications.integration.test.ts
// E2E_GRANT_ADMIN_COMMAND runs `node scripts/grant-support-admin.mjs "$ADMIN_EMAIL"` against the isolated database
// (announcements and ticket-status events need a support administrator). Without it those tests are skipped.
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { before, describe, it } from 'node:test';

const BASE = process.env.E2E_BASE_URL;
const GRANT = process.env.E2E_GRANT_ADMIN_COMMAND;

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
    await this.request('/api/auth/callback/credentials', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ csrfToken: body.csrfToken, email, password, json: 'true' }).toString(),
    });
  }
}

const run = Date.now();
const PASSWORD = 'Correct-Horse-Battery-9';
const NEW_PASSWORD = 'Another-Strong-Pass-42';
let counter = 0;
const nextIp = () => { counter++; return `10.${(run % 200) + 1}.55.${(counter % 250) + 1}`; };

async function member(tag: string) {
  const email = `cineverse-e2e-notif-${tag}+${run}@example.com`;
  assert.equal((await new Client().json('/api/auth/register', { method: 'POST', json: { name: `Notif ${tag}`, email, password: PASSWORD } })).status, 201);
  const client = new Client();
  await client.login(email, PASSWORD);
  return { client, email };
}

const list = async (client: Client, query = '') => (await client.json(`/api/notifications${query}`)).body;
const unread = async (client: Client) => (await client.json('/api/notifications/unread-count')).body.unreadCount as number;
const everything = async (client: Client, filter = 'all') => {
  const out: any[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 20; page++) {
    const body: any = await list(client, `?filter=${filter}&limit=10${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
    out.push(...body.notifications);
    cursor = body.nextCursor;
    if (!cursor) break;
  }
  return out;
};
// An administrator's bell also carries the support events (types "admin_*", see support-admin.integration.test.ts): these tests are
// about what ticket events do to everyone else's personal notifications, so they count the personal ones only.
const personalUnread = async (client: Client) => (await everything(client, 'unread')).filter((item) => !String(item.type).startsWith('admin_')).length;
const changePassword = (client: Client, current: string, next: string) => client.json('/api/account/password', { method: 'POST', json: { currentPassword: current, newPassword: next, confirmPassword: next } });
const profileWithPin = async (client: Client, name: string, pin: string) => (await client.json('/api/profiles', { method: 'POST', json: { name, avatar: 'ember', isKids: false, maturityLevel: 18, preferences: [], language: 'fr-FR', pin, confirmPin: pin } })).body.profile.id as string;
const submitTicket = (client: Client, subject: string) => client.json('/api/support', { method: 'POST', headers: { 'x-forwarded-for': nextIp() }, json: { subject, category: 'technical', email: `visitor-${run}-${counter}@example.com`, message: `Bonjour, voici un message de test assez long pour le sujet « ${subject} », merci.`, elapsedMs: 9000 } });

let admin: { client: Client; email: string } | null = null;
const adminOnly = { skip: !GRANT };
const announce = (client: Client, extra: object = {}) => client.json('/api/admin/announcements', { method: 'POST', json: { category: 'service', title: `Annonce ${run} ${++counter}`, message: 'Un message de test pour les notifications.', href: '/help', ...extra } });

describe('Notification center (isolated database)', { skip: !BASE }, () => {
  before(async () => {
    if (!BASE || !GRANT) return;
    const created = await member('admin');
    execSync(GRANT, { env: { ...process.env, ADMIN_EMAIL: created.email }, stdio: 'ignore' }); // restarts the isolated stack
    const client = new Client();
    await client.login(created.email, PASSWORD);
    admin = { client, email: created.email };
  });

  it('every notification endpoint refuses anonymous requests', async () => {
    const anon = new Client();
    const calls: [string, string, unknown?][] = [
      ['GET', '/api/notifications'], ['GET', '/api/notifications/unread-count'], ['PATCH', '/api/notifications/abc', { read: true }],
      ['POST', '/api/notifications/read-all', {}], ['GET', '/api/notifications/preferences'], ['PUT', '/api/notifications/preferences', { service: false }],
      ['GET', '/api/admin/announcements'], ['POST', '/api/admin/announcements', { category: 'service', title: 'Hello', message: 'Hello world' }], ['DELETE', '/api/admin/announcements/abc'],
    ];
    for (const [method, path, json] of calls) assert.equal((await anon.json(path, { method, json })).status, 401, `${method} ${path}`);
  });

  it('a new account has no notification and no badge', async () => {
    const { client } = await member('empty');
    const body = await list(client);
    assert.deepEqual([body.notifications, body.unreadCount, body.nextCursor], [[], 0, null]);
    assert.equal(await unread(client), 0);
  });

  it('a password change notifies its owner once, without any secret, and nobody else', async () => {
    const owner = await member('password');
    const bystander = await member('bystander');
    assert.equal((await changePassword(owner.client, PASSWORD, NEW_PASSWORD)).status, 200);
    const body = await list(owner.client);
    assert.equal(body.notifications.length, 1);
    assert.equal(body.unreadCount, 1);
    const item = body.notifications[0];
    assert.deepEqual([item.category, item.type, item.read, item.title], ['security', 'password_changed', false, 'Mot de passe modifié']);
    assert.match(item.href, /^\/help\//);
    for (const forbidden of [PASSWORD, NEW_PASSWORD, '$2b$']) assert.equal(JSON.stringify(body).includes(forbidden), false, 'no secret in the notification');
    assert.equal(await unread(bystander.client), 0, 'another account is not notified');
  });

  it('marks one notification read or unread, and all as read; the badge count follows the database', async () => {
    const { client } = await member('read');
    for (const next of [NEW_PASSWORD, `${NEW_PASSWORD}-b`]) assert.equal((await changePassword(client, next === NEW_PASSWORD ? PASSWORD : NEW_PASSWORD, next)).status, 200);
    let all = await everything(client);
    assert.equal(all.length, 2);
    assert.equal(await unread(client), 2);
    const [first, second] = all;
    const read = await client.json(`/api/notifications/${first.id}`, { method: 'PATCH', json: { read: true } });
    assert.equal(read.status, 200);
    assert.equal(read.body.notification.read, true);
    assert.equal(read.body.unreadCount, 1);
    assert.deepEqual((await everything(client, 'unread')).map((item) => item.id), [second.id], 'the unread filter');
    assert.equal((await client.json(`/api/notifications/${first.id}`, { method: 'PATCH', json: { read: false } })).body.unreadCount, 2, 'back to unread');
    assert.equal((await client.json('/api/notifications/read-all', { method: 'POST', json: {} })).body.updated, 2);
    assert.equal(await unread(client), 0);
    assert.equal((await client.json('/api/notifications/read-all', { method: 'POST', json: {} })).body.updated, 0, 'nothing left to mark');
    all = await everything(client);
    assert.ok(all.every((item) => item.read));
    assert.equal((await client.json('/api/notifications/does-not-exist', { method: 'PATCH', json: { read: true } })).status, 404);
    for (const bad of [{}, { read: 'yes' }, { read: true, userId: 'x' }]) assert.equal((await client.json(`/api/notifications/${first.id}`, { method: 'PATCH', json: bad })).status, 400, JSON.stringify(bad));
    assert.equal((await client.json(`/api/notifications/${first.id}`, { method: 'PATCH', json: { read: true }, headers: { origin: 'https://evil.example' } })).status, 403, 'cross-site refused');
  });

  it('one account cannot read or change another account’s notifications', async () => {
    const alice = await member('alice');
    const bob = await member('bob');
    assert.equal((await changePassword(alice.client, PASSWORD, NEW_PASSWORD)).status, 200);
    const aliceItem = (await list(alice.client)).notifications[0];
    assert.deepEqual((await list(bob.client, `?userId=${encodeURIComponent(alice.email)}`)).notifications, [], 'a user id in the URL changes nothing');
    assert.equal((await bob.client.json(`/api/notifications/${aliceItem.id}`, { method: 'PATCH', json: { read: true } })).status, 404, 'looks like it does not exist');
    assert.equal(JSON.stringify((await bob.client.json('/api/notifications')).body).includes(aliceItem.id), false);
    await bob.client.json('/api/notifications/read-all', { method: 'POST', json: {} });
    assert.equal(await unread(alice.client), 1, 'Bob’s “mark all” did not touch Alice');
    assert.equal((await list(alice.client)).notifications[0].read, false);
  });

  it('a PIN change and a PIN lockout notify the owner; a lockout is notified once however many attempts follow', async () => {
    const { client } = await member('pin');
    const id = await profileWithPin(client, 'Alex', '7392');
    const put = (json: object) => client.json(`/api/profiles/${id}/pin`, { method: 'PUT', json });
    assert.equal((await put({ pin: '5038', confirmPin: '5038', password: PASSWORD })).status, 200);
    let items = await everything(client);
    const changed = items.find((item) => item.type === 'pin_changed');
    assert.ok(changed, 'PIN change notified');
    assert.match(changed.message, /Alex/);
    for (const digits of ['7392', '5038', PASSWORD]) assert.equal(JSON.stringify(items).includes(digits), false, 'no PIN or password');
    for (let i = 0; i < 10; i++) await client.json(`/api/profiles/${id}/unlock`, { method: 'POST', json: { pin: '9999' } }); // 5 refused, then locked
    items = await everything(client);
    assert.equal(items.filter((item) => item.type === 'pin_lockout').length, 1, 'one lockout notification');
    assert.equal(items.find((item) => item.type === 'pin_lockout').category, 'security');
  });

  it('closing sessions notifies the owner', async () => {
    const { client, email } = await member('sessions');
    const second = new Client(); await second.login(email, PASSWORD);
    assert.equal((await client.json('/api/account/sessions', { method: 'DELETE', json: { scope: 'others' } })).status, 200);
    const items = await everything(client);
    assert.ok(items.some((item) => item.type === 'sessions_revoked' && item.title === 'Autres sessions fermées'));
  });

  it('support ticket events notify only the member who sent the ticket, and only for real status changes', adminOnly, async () => {
    const author = await member('ticket-author');
    const other = await member('ticket-other');
    const before = [await personalUnread(admin!.client), await personalUnread(other.client)];
    const subject = `Suivi notifié ${run}`;
    const created = await submitTicket(author.client, subject);
    assert.equal(created.status, 201);
    assert.ok((await everything(author.client)).some((item) => item.type === 'ticket_created' && item.message.includes(created.body.reference)), 'confirmation for the author');

    const ticket = (await admin!.client.json('/api/admin/support/tickets?page=1')).body.tickets.find((item: any) => item.reference === created.body.reference);
    const url = `/api/admin/support/tickets/${ticket.id}`;
    const statusItems = async () => (await everything(author.client)).filter((item) => item.type === 'ticket_status');
    assert.equal((await admin!.client.json(url, { method: 'PATCH', json: { adminNote: 'Note interne.' } })).status, 200);
    assert.equal((await statusItems()).length, 0, 'an internal note notifies nobody');
    assert.equal((await admin!.client.json(url, { method: 'PATCH', json: { status: 'resolved' } })).status, 200);
    let items = await statusItems();
    assert.equal(items.length, 1);
    assert.equal(items[0].title, 'Demande résolue');
    assert.ok(items[0].message.includes(created.body.reference));
    assert.equal((await admin!.client.json(url, { method: 'PATCH', json: { status: 'resolved' } })).status, 200);
    assert.equal((await statusItems()).length, 1, 'the same status again is not a change');
    assert.equal((await admin!.client.json(url, { method: 'PATCH', json: { status: 'in_progress', adminNote: 'Rouvert.' } })).status, 200);
    items = await statusItems();
    assert.equal(items.length, 2, 'a new status is a new event');
    assert.equal(JSON.stringify(items).includes('Note interne'), false, 'staff notes are never shown');
    assert.deepEqual([await personalUnread(admin!.client), await personalUnread(other.client)], before, 'nobody else was notified');
  });

  it('a guest ticket notifies nobody when staff update it', adminOnly, async () => {
    const watchers = [await member('guest-watch-1'), await member('guest-watch-2')];
    const counts = async () => [await personalUnread(admin!.client), ...(await Promise.all(watchers.map((watcher) => personalUnread(watcher.client))))];
    const before = await counts();
    const subject = `Invité ${run}`;
    const created = await submitTicket(new Client(), subject);
    assert.equal(created.status, 201);
    const ticket = (await admin!.client.json('/api/admin/support/tickets?page=1')).body.tickets.find((item: any) => item.reference === created.body.reference);
    assert.equal(ticket.accountLinked, false);
    for (const status of ['in_progress', 'resolved', 'closed']) assert.equal((await admin!.client.json(`/api/admin/support/tickets/${ticket.id}`, { method: 'PATCH', json: { status } })).status, 200);
    assert.deepEqual(await counts(), before, 'no account received anything');
  });

  it('has functional preferences for the two optional categories only', async () => {
    const { client } = await member('prefs');
    const defaults = await client.json('/api/notifications/preferences');
    assert.deepEqual([defaults.body.catalogue, defaults.body.service], [true, true]);
    assert.deepEqual(defaults.body.alwaysOn, ['security', 'support']);
    const updated = await client.json('/api/notifications/preferences', { method: 'PUT', json: { catalogue: false } });
    assert.deepEqual([updated.body.catalogue, updated.body.service], [false, true]);
    assert.deepEqual([(await client.json('/api/notifications/preferences')).body.catalogue, (await client.json('/api/notifications/preferences')).body.service], [false, true], 'persisted');
    for (const bad of [{}, { security: false }, { support: false }, { catalogue: 'no' }, { catalogue: false, extra: 1 }]) assert.equal((await client.json('/api/notifications/preferences', { method: 'PUT', json: bad })).status, 400, JSON.stringify(bad));
    assert.equal((await client.json('/api/notifications/preferences', { method: 'PUT', json: { service: false }, headers: { origin: 'https://evil.example' } })).status, 403);
  });

  it('keeps announcements closed to everyone except support staff', async () => {
    const ordinary = await member('announce-ordinary');
    const payload = { category: 'service', title: 'Je ne devrais pas pouvoir', message: 'Envoi à tous les comptes.' };
    assert.equal((await ordinary.client.json('/api/admin/announcements', { method: 'POST', json: payload })).status, 404);
    assert.equal((await ordinary.client.json('/api/admin/announcements')).status, 404);
    assert.equal((await ordinary.client.json('/api/admin/announcements/abc', { method: 'DELETE' })).status, 404);
    assert.equal(await unread(ordinary.client), 0, 'nothing was sent');
  });

  it('refuses announcements with an external destination, a protected category or bad text', adminOnly, async () => {
    const title = `Validation ${run}`;
    for (const bad of [{ href: 'https://evil.example' }, { href: '//evil.example' }, { href: 'javascript:alert(1)' }, { category: 'security' }, { category: 'support' }, { title: 'ab' }, { message: 'x'.repeat(401) }, { userId: 'everyone' }]) {
      const res = await announce(admin!.client, { title, ...bad });
      assert.equal(res.status, 400, JSON.stringify(bad).slice(0, 50));
    }
    assert.equal((await admin!.client.json('/api/admin/announcements', { method: 'POST', json: { category: 'service', title, message: 'Valide.', href: '/help' }, headers: { origin: 'https://evil.example' } })).status, 403, 'cross-site refused');
  });

  it('delivers a catalogue announcement only to accounts that accept it, and withdrawing it removes it everywhere', adminOnly, async () => {
    const optedIn = await member('catalogue-in');
    const optedOut = await member('catalogue-out');
    await optedOut.client.json('/api/notifications/preferences', { method: 'PUT', json: { catalogue: false } });
    const title = `Nouveautés du catalogue ${run}`;
    const sent = await announce(admin!.client, { title, category: 'catalogue', href: '/films-series-catalog' });
    assert.equal(sent.status, 201);
    assert.ok(sent.body.announcement.recipientCount >= 2 - 1, 'recipient count reported');
    const mine = (await everything(optedIn.client)).find((item) => item.title === title);
    assert.ok(mine, 'the opted-in account received it');
    assert.deepEqual([mine.category, mine.type, mine.href, mine.read], ['catalogue', 'announcement', '/films-series-catalog', false]);
    assert.equal((await everything(optedOut.client)).some((item) => item.title === title), false, 'the opted-out account did not');
    assert.equal(await unread(optedOut.client), 0);
    assert.equal((await announce(admin!.client, { title, category: 'catalogue', href: '/films-series-catalog' })).status, 409, 'an identical announcement is refused');
    const listing = (await admin!.client.json('/api/admin/announcements')).body.announcements.find((item: any) => item.id === sent.body.announcement.id);
    assert.ok(listing && listing.recipientCount === sent.body.announcement.recipientCount);
    await optedIn.client.json(`/api/notifications/${mine.id}`, { method: 'PATCH', json: { read: true } });
    assert.equal((await admin!.client.json('/api/admin/announcements')).body.announcements.find((item: any) => item.id === sent.body.announcement.id).readCount, 1, 'read count tracked');
    const url = `/api/admin/announcements/${sent.body.announcement.id}`;
    assert.equal((await admin!.client.json(url, { method: 'DELETE', headers: { origin: 'https://evil.example' } })).status, 403);
    assert.equal((await admin!.client.json(url, { method: 'DELETE' })).status, 200);
    assert.equal((await everything(optedIn.client)).some((item) => item.title === title), false, 'withdrawn from the notification list');
    assert.equal((await admin!.client.json(url, { method: 'DELETE' })).status, 404);
  });

  it('paginates newest first without gaps or repeats, and the count matches the unread items', adminOnly, async () => {
    const { client } = await member('pages');
    for (let i = 0; i < 4; i++) assert.equal((await announce(admin!.client, { title: `Page ${run} ${i} ${++counter}`, message: `Message de pagination numéro ${i}.` })).status, i < 4 ? 201 : 429, `announcement ${i}`);
    const first = await list(client, '?limit=3');
    assert.equal(first.notifications.length, 3);
    assert.ok(first.nextCursor);
    const second = await list(client, `?limit=3&cursor=${encodeURIComponent(first.nextCursor)}`);
    const ids = [...first.notifications, ...second.notifications].map((item: any) => item.id);
    assert.equal(new Set(ids).size, ids.length, 'no repeats');
    const dates = [...first.notifications, ...second.notifications].map((item: any) => Date.parse(item.createdAt));
    assert.deepEqual([...dates].sort((a, b) => b - a), dates, 'newest first');
    const all = await everything(client);
    assert.equal(all.length, 4);
    assert.equal(all.filter((item) => !item.read).length, await unread(client), 'badge count equals the unread items');
    assert.equal((await client.json('/api/notifications?limit=31')).status, 400, 'the page size is capped');
    assert.equal((await client.json('/api/notifications?limit=0')).status, 400);
    assert.equal((await client.json('/api/notifications?cursor=garbage')).status, 400);
    assert.equal((await client.json('/api/notifications?filter=everything')).status, 400);
  });

  it('limits how many announcements can be sent per hour', adminOnly, async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 8; i++) statuses.push((await announce(admin!.client, { title: `Limite ${run} ${i} ${++counter}`, message: 'Test de limite d’envoi.' })).status);
    assert.ok(statuses.includes(429), `the per-hour limit applied (${statuses.join(',')})`);
    assert.ok(statuses.filter((status) => status === 201).length <= 5);
  });
});
