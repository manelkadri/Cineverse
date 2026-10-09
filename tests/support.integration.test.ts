/* eslint-disable @typescript-eslint/no-explicit-any -- JSON response bodies in black-box API tests */
// Support tickets and the support admin area, tested through the real HTTP API of a running server backed by an
// ISOLATED database.
//   E2E_BASE_URL=http://localhost:4101 E2E_GRANT_ADMIN_COMMAND="bash grant-admin.sh" npx tsx --test tests/support.integration.test.ts
// E2E_GRANT_ADMIN_COMMAND is a shell command that runs `node scripts/grant-support-admin.mjs "$ADMIN_EMAIL"` against the
// isolated database (the app cannot make anyone an administrator, by design). Without it the admin tests are skipped.
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
    const res = await send().catch(() => send()); // a restarted server leaves a stale keep-alive socket behind
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
let counter = 0;
const nextIp = () => { counter++; return `10.${(run % 200) + 1}.${Math.floor(counter / 250)}.${(counter % 250) + 1}`; };
const email = (tag: string) => `cineverse-e2e-support-${tag}+${run}@example.com`;

async function member(tag: string) {
  const address = email(tag);
  assert.equal((await new Client().json('/api/auth/register', { method: 'POST', json: { name: `Support ${tag}`, email: address, password: PASSWORD } })).status, 201);
  const client = new Client();
  await client.login(address, PASSWORD);
  return { client, email: address };
}

let uniq = 0;
const payload = (extra: object = {}) => {
  uniq++;
  return { subject: `Problème numéro ${uniq}`, category: 'technical', email: email(`visitor${uniq}`), message: `Bonjour, le catalogue affiche une erreur lors du chargement de la page numéro ${uniq}, merci de regarder.`, elapsedMs: 9000, ...extra };
};
const submit = (client: Client, extra: object = {}, ip = nextIp(), headers: Record<string, string> = {}) =>
  client.json('/api/support', { method: 'POST', json: payload(extra), headers: { 'x-forwarded-for': ip, ...headers } });

let admin: { client: Client; email: string } | null = null;
const adminOnly = { skip: !GRANT };

describe('Support tickets (isolated database)', { skip: !BASE }, () => {
  before(async () => {
    if (!BASE || !GRANT) return;
    const created = await member('admin');
    execSync(GRANT, { env: { ...process.env, ADMIN_EMAIL: created.email }, stdio: 'ignore' }); // restarts the isolated stack
    const client = new Client();
    await client.login(created.email, PASSWORD);
    admin = { client, email: created.email };
  });

  it('a visitor can send a request; it is really stored and no e-mail is claimed', async () => {
    const res = await submit(new Client());
    assert.equal(res.status, 201);
    assert.equal(res.body.stored, true);
    assert.match(res.body.reference, /^CV-[0-9A-Z]{8}$/);
    assert.equal(res.body.emailSent, false, 'no mail provider: nothing is claimed to have been sent');
    assert.equal(res.text.includes('ipHash') || res.text.includes('messageHash'), false);
  });

  it('validates every field on the server', async () => {
    const visitor = new Client();
    for (const bad of [{ subject: 'ab' }, { subject: 'x'.repeat(121) }, { category: 'billing' }, { category: '' }, { email: 'nope' }, { email: '' }, { message: 'trop court' }, { message: 'x'.repeat(2001) }, { subject: 42 }]) {
      const res = await submit(visitor, bad);
      assert.equal(res.status, 400, JSON.stringify(bad).slice(0, 60));
      assert.equal(res.body.code, 'INVALID_REQUEST');
      assert.ok(res.body.error.length > 5);
    }
    for (const extra of [{ userId: 'someone-else' }, { status: 'closed' }, { isSupportAdmin: true }]) assert.equal((await submit(visitor, extra)).status, 400, `extra field ${Object.keys(extra)[0]}`);
    assert.equal((await visitor.json('/api/support', { method: 'POST', json: null })).status, 400);
  });

  it('refuses passwords, PINs and tokens in a message, and stores nothing', async () => {
    const visitor = new Client();
    const tag = `secret-${run}`;
    const secrets = ['Mon mot de passe : Azerty-2024!x pour info', 'le code PIN est 7392 merci', 'token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijk', 'hash $2b$12$abcdefghijklmnopqrstuv copié depuis la base'];
    for (const secret of secrets) {
      const res = await submit(visitor, { message: `Bonjour ${tag}, voici ce qui se passe : ${secret} et rien ne marche.` });
      assert.equal(res.status, 400, secret);
      assert.equal(res.body.code, 'SENSITIVE_CONTENT');
      assert.equal(res.text.includes('Azerty') || res.text.includes('7392'), false, 'the secret is never echoed');
    }
    const fine = await submit(visitor, { message: 'J’ai oublié mon mot de passe et mon code PIN ne fonctionne plus depuis ce matin, que faire ?' });
    assert.equal(fine.status, 201, 'ordinary sentences about passwords are accepted');
    if (admin) {
      const list = await admin.client.json('/api/admin/support/tickets?page=1');
      assert.equal(JSON.stringify(list.body).includes(tag), false, 'rejected messages were never stored');
    }
  });

  it('stops bots: honeypot, too-fast submissions, link spam, cross-site and non-JSON requests', async () => {
    const visitor = new Client();
    assert.equal((await submit(visitor, { website: 'http://spam.example' })).body.code, 'SPAM');
    assert.equal((await submit(visitor, { elapsedMs: 300 })).body.code, 'TOO_FAST');
    const links = await submit(visitor, { message: 'Regardez https://a.example https://b.example https://c.example https://d.example pour un bon prix.' });
    assert.equal(links.body.code, 'TOO_MANY_LINKS');
    const cross = await submit(visitor, {}, nextIp(), { origin: 'https://evil.example' });
    assert.equal(cross.status, 403);
    assert.equal(cross.body.code, 'CROSS_SITE');
    const text = await visitor.json('/api/support', { method: 'POST', headers: { 'content-type': 'text/plain', 'x-forwarded-for': nextIp() }, body: JSON.stringify(payload()) });
    assert.equal(text.status, 415);
  });

  it('limits requests per address, per e-mail, and refuses an identical request twice', async () => {
    const visitor = new Client();
    const ip = nextIp();
    for (let i = 0; i < 5; i++) assert.equal((await submit(visitor, {}, ip)).status, 201, `request ${i + 1}`);
    const limited = await submit(visitor, {}, ip);
    assert.equal(limited.status, 429);
    assert.equal(limited.body.code, 'RATE_LIMITED');
    assert.ok(Number(limited.headers.get('retry-after')) > 0);
    assert.equal((await submit(visitor, {}, nextIp())).status, 201, 'another address is not affected');

    const same = email('same-address');
    for (let i = 0; i < 3; i++) assert.equal((await submit(visitor, { email: same }, nextIp())).status, 201, `e-mail request ${i + 1}`);
    assert.equal((await submit(visitor, { email: same }, nextIp())).status, 429, 'the fourth request for one e-mail in an hour');

    const once = payload({ email: email('dup') });
    assert.equal((await visitor.json('/api/support', { method: 'POST', json: once, headers: { 'x-forwarded-for': nextIp() } })).status, 201);
    const twice = await visitor.json('/api/support', { method: 'POST', json: once, headers: { 'x-forwarded-for': nextIp() } });
    assert.equal(twice.status, 409);
    assert.equal(twice.body.code, 'DUPLICATE');
  });

  it('a burst of parallel requests cannot go past the per-address limit', async () => {
    const visitor = new Client();
    const ip = nextIp();
    const results = await Promise.all(Array.from({ length: 12 }, () => submit(visitor, {}, ip)));
    const stored = results.filter((res) => res.status === 201).length;
    assert.ok(stored <= 5, `${stored} tickets were stored`);
    assert.ok(stored >= 1);
    assert.ok(results.filter((res) => res.status === 429).length >= 7);
  });

  it('keeps the admin area closed to visitors and ordinary members, with no way to self-promote', async () => {
    const anon = new Client();
    for (const [method, path] of [['GET', '/api/admin/support/tickets'], ['PATCH', '/api/admin/support/tickets/abc'], ['DELETE', '/api/admin/support/tickets/abc']] as const) {
      assert.equal((await anon.json(path, { method, json: method === 'PATCH' ? { status: 'closed' } : undefined })).status, 401, `${method} anonymous`);
    }
    const page = await anon.request('/admin/support');
    assert.equal(page.status, 307, 'the admin page needs a login');

    const ordinary = await member('ordinary');
    for (const [method, path] of [['GET', '/api/admin/support/tickets'], ['PATCH', '/api/admin/support/tickets/abc'], ['DELETE', '/api/admin/support/tickets/abc']] as const) {
      const res = await ordinary.client.json(path, { method, json: method === 'PATCH' ? { status: 'closed' } : undefined });
      assert.equal(res.status, 404, `${method} as an ordinary member looks like a missing page`);
    }
    assert.equal((await ordinary.client.json('/api/account')).body.supportAdmin, false);
    assert.equal((await ordinary.client.json('/api/account', { method: 'PATCH', json: { name: 'Mallory', isSupportAdmin: true } })).status, 400, 'the account route rejects an admin flag');
    assert.equal((await ordinary.client.json('/api/admin/support/tickets')).status, 404, 'still not staff');
  });

  it('attaches a ticket to the signed-in account (from the session only) and removes it with the account', adminOnly, async () => {
    const author = await member('author');
    const subject = `Ticket de membre ${run}`;
    const res = await submit(author.client, { subject });
    assert.equal(res.status, 201);
    const list = (await admin!.client.json(`/api/admin/support/tickets?page=1`)).body;
    const mine = list.tickets.find((ticket: any) => ticket.subject === subject);
    assert.ok(mine, 'the admin sees the ticket');
    assert.equal(mine.accountLinked, true);
    assert.equal(Object.keys(mine).some((key) => /hash|userId/i.test(key)), false, 'no internal fields leak to the admin UI');
    // deleting the account deletes the personal data linked to it, tickets included
    assert.equal((await author.client.json('/api/account', { method: 'DELETE', json: { password: PASSWORD, confirmation: 'SUPPRIMER' } })).status, 200);
    const after = (await admin!.client.json(`/api/admin/support/tickets?page=1`)).body;
    assert.equal(after.tickets.some((ticket: any) => ticket.subject === subject), false, 'the ticket was erased with the account');
  });

  it('lets support staff list, filter, update and delete tickets', adminOnly, async () => {
    assert.equal((await admin!.client.json('/api/account')).body.supportAdmin, true);
    const subject = `Suivi admin ${run}`;
    const created = await submit(new Client(), { subject, category: 'profiles' });
    assert.equal(created.status, 201);

    const list = await admin!.client.json('/api/admin/support/tickets?page=1');
    assert.equal(list.status, 200);
    assert.equal(list.body.pageSize, 20);
    assert.ok(list.body.total >= 1 && list.body.counts.open >= 1);
    const ticket = list.body.tickets.find((item: any) => item.subject === subject);
    assert.ok(ticket);
    assert.equal(ticket.reference, created.body.reference);
    assert.equal(ticket.accountLinked, false);
    const dates = list.body.tickets.map((item: any) => Date.parse(item.createdAt));
    assert.deepEqual([...dates].sort((a, b) => b - a), dates, 'newest first');
    assert.ok((await admin!.client.json('/api/admin/support/tickets?category=profiles')).body.tickets.every((item: any) => item.category === 'profiles'));
    assert.deepEqual((await admin!.client.json('/api/admin/support/tickets?status=resolved&category=profiles&page=999')).body.tickets, []);

    const url = `/api/admin/support/tickets/${ticket.id}`;
    const updated = await admin!.client.json(url, { method: 'PATCH', json: { status: 'in_progress', adminNote: 'Pris en charge.' } });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.ticket.status, 'in_progress');
    assert.equal(updated.body.ticket.adminNote, 'Pris en charge.');
    for (const bad of [{}, { status: 'deleted' }, { message: 'edited' }, { adminNote: 'x'.repeat(2001) }]) assert.equal((await admin!.client.json(url, { method: 'PATCH', json: bad })).status, 400, JSON.stringify(bad).slice(0, 40));
    assert.equal((await admin!.client.json('/api/admin/support/tickets/does-not-exist', { method: 'PATCH', json: { status: 'closed' } })).status, 404);
    assert.equal((await admin!.client.json(url, { method: 'PATCH', json: { status: 'closed' }, headers: { origin: 'https://evil.example' } })).status, 403, 'cross-site refused');

    assert.equal((await admin!.client.json(url, { method: 'DELETE' })).status, 200);
    assert.equal((await admin!.client.json(url, { method: 'DELETE' })).status, 404);
    assert.equal((await admin!.client.json('/api/admin/support/tickets?page=1')).body.tickets.some((item: any) => item.id === ticket.id), false);
  });
});
