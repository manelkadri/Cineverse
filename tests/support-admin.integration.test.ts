/* eslint-disable @typescript-eslint/no-explicit-any -- JSON response bodies in black-box API tests */
// Support administration (tickets, conversations, notifications, knowledge base, analytics, settings, audit), tested through the
// real HTTP API of a running server backed by an ISOLATED database.
//   E2E_BASE_URL=http://localhost:4101 E2E_GRANT_ADMIN_COMMAND="bash grant-admin.sh" npx tsx --test tests/support-admin.integration.test.ts
// E2E_GRANT_ADMIN_COMMAND runs `node scripts/grant-support-admin.mjs` for every address of $ADMIN_EMAIL (comma-separated)
// against the isolated database. Without it this suite is skipped: nobody can be made an administrator through the app.
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { before, describe, it } from 'node:test';
import { HELP_ARTICLES, HELP_FAQ } from '../src/lib/help-content';

const BASE = process.env.E2E_BASE_URL;
const GRANT = process.env.E2E_GRANT_ADMIN_COMMAND;

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
}

const run = Date.now();
const PASSWORD = 'Correct-Horse-Battery-9';
let counter = 0;
const nextIp = () => { counter++; return `10.${(run % 200) + 1}.66.${(counter % 250) + 1}`; };
const email = (tag: string) => `cineverse-e2e-sadmin-${tag}+${run}@example.com`;

async function member(tag: string) {
  const address = email(tag);
  assert.equal((await new Client().json('/api/auth/register', { method: 'POST', json: { name: `Sadmin ${tag}`, email: address, password: PASSWORD } })).status, 201);
  const client = new Client();
  await client.login(address, PASSWORD);
  return { client, email: address };
}

let uniq = 0;
const submit = (client: Client, subject: string, extra: object = {}) => {
  uniq++;
  return client.json('/api/support', { method: 'POST', headers: { 'x-forwarded-for': nextIp() }, json: { subject, category: 'technical', email: email(`v${uniq}`), message: `Bonjour, voici un message de test assez long pour « ${subject} » (${uniq}), merci de regarder.`, elapsedMs: 9000, ...extra } });
};

let A: { client: Client; email: string };
let B: { client: Client; email: string };
let idA = '';
let idB = '';
const adminOnly = { skip: !GRANT };
const listAll = async (client: Client, query = '') => (await client.json(`/api/admin/support/tickets${query ? `?${query}` : ''}`)).body;
const findTicket = async (client: Client, subject: string) => (await listAll(client, `q=${encodeURIComponent(subject)}`)).tickets.find((ticket: any) => ticket.subject === subject);
const patch = (client: Client, id: string, json: object) => client.json(`/api/admin/support/tickets/${id}`, { method: 'PATCH', json });
const adminNotes = async (client: Client, filter = 'all') => (await client.json(`/api/admin/support/notifications?filter=${filter}&limit=30`)).body;
const staffId = async (client: Client, mail: string) => (await client.json('/api/admin/support/staff')).body.staff.find((s: any) => s.email === mail).id as string;

describe('Support administration (isolated database)', { skip: !BASE }, () => {
  before(async () => {
    if (!BASE || !GRANT) return;
    const a = await member('admin-a');
    const b = await member('admin-b');
    execSync(GRANT, { env: { ...process.env, ADMIN_EMAIL: `${a.email},${b.email}` }, stdio: 'ignore' });
    A = { client: new Client(), email: a.email }; await A.client.login(a.email, PASSWORD);
    B = { client: new Client(), email: b.email }; await B.client.login(b.email, PASSWORD);
    idA = await staffId(A.client, a.email);
    idB = await staffId(A.client, b.email);
  });

  it('every administration endpoint refuses visitors (401) and ordinary members (a plain 404)', adminOnly, async () => {
    const ordinary = await member('ordinary');
    const calls: [string, string, unknown?][] = [
      ['GET', '/api/admin/support/me'], ['GET', '/api/admin/support/overview'], ['GET', '/api/admin/support/tickets'], ['GET', '/api/admin/support/tickets/abc'],
      ['PATCH', '/api/admin/support/tickets/abc', { priority: 'high' }], ['DELETE', '/api/admin/support/tickets/abc'], ['POST', '/api/admin/support/tickets/abc/messages', { body: 'x', visibility: 'internal' }],
      ['GET', '/api/admin/support/staff'], ['GET', '/api/admin/support/analytics'], ['GET', '/api/admin/support/audit'], ['GET', '/api/admin/support/settings'],
      ['PUT', '/api/admin/support/settings/availability', { enabled: false, text: '' }], ['PUT', '/api/admin/support/settings/preferences', { notifyNewTicket: false }],
      ['GET', '/api/admin/support/categories'], ['POST', '/api/admin/support/categories', { id: 'hack', label: 'Hack' }], ['PATCH', '/api/admin/support/categories/other', { enabled: false }],
      ['GET', '/api/admin/support/notifications'], ['POST', '/api/admin/support/notifications/read-all', {}],
      ['GET', '/api/admin/support/kb/articles'], ['POST', '/api/admin/support/kb/articles', {}], ['GET', '/api/admin/support/kb/articles/creer-un-compte'], ['PUT', '/api/admin/support/kb/articles/creer-un-compte', {}], ['DELETE', '/api/admin/support/kb/articles/creer-un-compte'],
      ['GET', '/api/admin/support/kb/faqs'], ['POST', '/api/admin/support/kb/faqs', {}], ['PUT', '/api/admin/support/kb/faqs/order', { keys: ['faq-creer-compte'] }],
    ];
    const anon = new Client();
    for (const [method, path, json] of calls) {
      assert.equal((await anon.json(path, { method, json })).status, 401, `anonymous ${method} ${path}`);
      assert.equal((await ordinary.client.json(path, { method, json })).status, 404, `ordinary member ${method} ${path}`);
    }
    assert.equal((await A.client.json('/api/admin/support/me')).status, 200);
    assert.equal((await ordinary.client.json('/api/account', { method: 'PATCH', json: { name: 'M', isSupportAdmin: true } })).status, 400, 'no way to self-promote');
  });

  it('lists tickets with server-side search, filters, sorting and pagination', adminOnly, async () => {
    const tag = `Liste${run}`;
    const owner = await member('list-owner');
    const guest = await submit(new Client(), `${tag} alpha invité`, { category: 'login', email: email('searchme') });
    const mine = await submit(owner.client, `${tag} bravo membre`, { category: 'profiles' });
    const third = await submit(new Client(), `${tag} charlie`, { category: 'login' });
    assert.deepEqual([guest.status, mine.status, third.status], [201, 201, 201]);
    const bravo = await findTicket(A.client, `${tag} bravo membre`);
    const charlie = await findTicket(A.client, `${tag} charlie`);
    assert.equal(bravo.accountLinked, true);
    assert.deepEqual([bravo.priority, bravo.awaitingStaff, bravo.assignedTo], ['normal', true, null], 'defaults');
    for (const forbidden of ['ipHash', 'messageHash', 'userId']) assert.equal(JSON.stringify(bravo).includes(forbidden), false, `no ${forbidden} in a list item`);

    // search: subject, e-mail fragment, reference
    assert.equal((await listAll(A.client, `q=${encodeURIComponent(`${tag} alpha`)}`)).total, 1);
    assert.ok((await listAll(A.client, 'q=searchme')).tickets.some((t: any) => t.subject.includes('alpha')), 'by e-mail');
    assert.equal((await listAll(A.client, `q=${encodeURIComponent(bravo.reference)}`)).tickets[0].subject, bravo.subject, 'by reference');
    assert.equal((await listAll(A.client, `q=${encodeURIComponent(tag.toUpperCase())}`)).total, 3, 'case-insensitive');
    // filters
    assert.equal((await listAll(A.client, `q=${tag}&category=login`)).total, 2);
    assert.equal((await listAll(A.client, `q=${tag}&category=profiles`)).total, 1);
    assert.equal((await patch(A.client, charlie.id, { priority: 'urgent', status: 'in_progress' })).status, 200);
    assert.equal((await listAll(A.client, `q=${tag}&priority=urgent`)).tickets[0].subject, charlie.subject);
    assert.equal((await listAll(A.client, `q=${tag}&status=in_progress`)).total, 1);
    assert.equal((await listAll(A.client, `q=${tag}&assignee=unassigned`)).total, 3);
    assert.equal((await patch(A.client, bravo.id, { assignedToId: idA })).status, 200);
    assert.equal((await listAll(A.client, `q=${tag}&assignee=me`)).total, 1);
    assert.equal((await listAll(B.client, `q=${tag}&assignee=me`)).total, 0, '"me" is the signed-in administrator');
    assert.equal((await listAll(A.client, `q=${tag}&assignee=${idA}`)).total, 1);
    assert.equal((await listAll(A.client, `q=${tag}&attention=1`)).total, 2, 'in-progress tickets were looked at; the other two still await staff');
    const day = new Date().toISOString().slice(0, 10);
    assert.equal((await listAll(A.client, `q=${tag}&from=${day}&to=${day}`)).total, 3, 'date range includes today');
    assert.equal((await listAll(A.client, `q=${tag}&from=2099-01-01`)).total, 0);
    assert.equal((await listAll(A.client, `q=${tag}&to=2000-01-01`)).total, 0);
    // sorting and pagination
    const newest = (await listAll(A.client, `q=${tag}&sort=newest`)).tickets.map((t: any) => t.subject);
    const oldest = (await listAll(A.client, `q=${tag}&sort=oldest`)).tickets.map((t: any) => t.subject);
    assert.deepEqual(oldest, [...newest].reverse());
    assert.equal((await listAll(A.client, `q=${tag}&sort=priority`)).tickets[0].subject, charlie.subject, 'urgent first');
    assert.equal((await listAll(A.client, `q=${tag}&sort=updated`)).tickets[0].subject, bravo.subject, 'most recently changed first');
    const page1 = await listAll(A.client, `q=${tag}&pageSize=2&page=1`);
    const page2 = await listAll(A.client, `q=${tag}&pageSize=2&page=2`);
    assert.deepEqual([page1.tickets.length, page2.tickets.length, page1.total, page1.pageSize], [2, 1, 3, 2]);
    assert.equal(new Set([...page1.tickets, ...page2.tickets].map((t: any) => t.id)).size, 3, 'no repeats across pages');
    for (const bad of ['status=weird', 'priority=extreme', 'page=0', 'pageSize=500', 'sort=random', 'from=yesterday', 'from=2026-12-31&to=2026-01-01']) assert.equal((await A.client.json(`/api/admin/support/tickets?${bad}`)).status, 400, bad);
  });

  it('shows a ticket with its conversation; a guest ticket cannot receive a public reply', adminOnly, async () => {
    const owner = await member('detail-owner');
    const subject = `Détail${run}`;
    await submit(owner.client, subject);
    await submit(new Client(), `${subject} invité`);
    const ticket = await findTicket(A.client, subject);
    const guest = await findTicket(A.client, `${subject} invité`);
    const detail = await A.client.json(`/api/admin/support/tickets/${ticket.id}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.canReplyPublicly, true);
    assert.match(detail.body.ticket.message, /message de test/);
    assert.deepEqual(detail.body.messages, []);
    assert.equal((await A.client.json(`/api/admin/support/tickets/${guest.id}`)).body.canReplyPublicly, false);
    assert.equal((await A.client.json('/api/admin/support/tickets/does-not-exist')).status, 404);
  });

  it('changes priority, status and assignment, keeps an audit trail, and notifies the right people', adminOnly, async () => {
    const owner = await member('change-owner');
    const subject = `Changements${run}`;
    await submit(owner.client, subject);
    const ticket = await findTicket(A.client, subject);
    const before = (await adminNotes(B.client)).unreadCount;

    // assignment: only a real administrator, audited, and the assignee is notified (but not when assigning oneself)
    assert.equal((await patch(A.client, ticket.id, { assignedToId: owner.email })).status, 400, 'not an id');
    const ordinaryId = 'cnotanadmin000000001'; // a well-formed id that belongs to no administrator
    const refused = await patch(A.client, ticket.id, { assignedToId: ordinaryId });
    assert.equal(refused.status, 400);
    assert.equal(refused.body.code, 'ASSIGNEE_INVALID', 'only existing administrators can be assigned');
    const assigned = await patch(A.client, ticket.id, { assignedToId: idB });
    assert.equal(assigned.body.ticket.assignedTo.id, idB);
    assert.ok((await adminNotes(B.client)).notifications.some((n: any) => n.type === 'admin_assigned' && n.href === `/admin/support/tickets/${ticket.id}`), 'the assignee is notified');
    const selfBefore = (await adminNotes(A.client)).notifications.filter((n: any) => n.type === 'admin_assigned').length;
    assert.equal((await patch(A.client, ticket.id, { assignedToId: idA })).status, 200);
    assert.equal((await adminNotes(A.client)).notifications.filter((n: any) => n.type === 'admin_assigned').length, selfBefore, 'self-assignment notifies nobody');
    assert.equal((await patch(A.client, ticket.id, { assignedToId: null })).body.ticket.assignedTo, null, 'unassign');

    // priority: high raises an alert for the other administrator
    assert.equal((await patch(A.client, ticket.id, { priority: 'extreme' })).status, 400);
    assert.equal((await patch(A.client, ticket.id, { priority: 'high' })).body.ticket.priority, 'high');
    assert.ok((await adminNotes(B.client)).notifications.some((n: any) => n.type === 'admin_high_priority'), 'high priority alerts the other administrator');
    assert.equal((await adminNotes(A.client)).notifications.some((n: any) => n.type === 'admin_high_priority' && n.message.includes(ticket.reference)), false, 'not the one who made the change');

    // status: every transition persists; the author is notified; reopening alerts the others
    const statuses: string[] = [];
    for (const status of ['in_progress', 'resolved', 'open']) { statuses.push((await patch(A.client, ticket.id, { status })).body.ticket.status); }
    assert.deepEqual(statuses, ['in_progress', 'resolved', 'open']);
    assert.equal((await A.client.json(`/api/admin/support/tickets/${ticket.id}`)).body.ticket.status, 'open', 'persisted');
    assert.ok((await adminNotes(B.client)).notifications.some((n: any) => n.type === 'admin_reopened'), 'a reopened ticket alerts the other administrator');
    const ownerItems = (await owner.client.json('/api/notifications?limit=30')).body.notifications;
    assert.equal(ownerItems.filter((n: any) => n.type === 'ticket_status').length, 3, 'the author was told about each real change');
    assert.ok(ownerItems.every((n: any) => !n.href || n.href === `/account/support/${ticket.id}` || !n.type.startsWith('ticket_')), 'notifications point to the ticket page');
    assert.ok((await adminNotes(B.client)).unreadCount > before);

    // the audit trail of this ticket
    const history = (await A.client.json(`/api/admin/support/tickets/${ticket.id}`)).body.history;
    const actions = history.map((entry: any) => entry.action);
    for (const expected of ['ticket.assigned', 'ticket.priority_changed', 'ticket.status_changed']) assert.ok(actions.includes(expected), expected);
    assert.equal(actions.filter((a: string) => a === 'ticket.status_changed').length, 3);
    assert.ok(history.every((entry: any) => entry.actorName.startsWith('Sadmin')), 'the actor is recorded');
    assert.equal((await patch(A.client, ticket.id, { status: 'open' })).status, 200);
    assert.equal((await A.client.json(`/api/admin/support/tickets/${ticket.id}`)).body.history.length, history.length, 'an unchanged value is not logged');
    for (const bad of [{}, { status: 'deleted' }, { priority: 3 }, { message: 'edited' }, { assignedToId: 5 }]) assert.equal((await patch(A.client, ticket.id, bad)).status, 400, JSON.stringify(bad));
  });

  it('lets staff reply from CINEVERSE: the author reads public replies, never the private notes', adminOnly, async () => {
    const owner = await member('reply-owner');
    const subject = `Réponse${run}`;
    await submit(owner.client, subject);
    const ticket = await findTicket(A.client, subject);
    const url = `/api/admin/support/tickets/${ticket.id}/messages`;
    const reply = await A.client.json(url, { method: 'POST', json: { body: 'Bonjour, nous regardons cela dès maintenant.', visibility: 'public' } });
    assert.equal(reply.status, 201);
    assert.equal(reply.body.message.senderType, 'staff');
    assert.equal((await A.client.json(url, { method: 'POST', json: { body: 'Bonjour, nous regardons cela dès maintenant.', visibility: 'public' } })).body.code, 'DUPLICATE', 'a double click is stored once');
    const note = await A.client.json(url, { method: 'POST', json: { body: 'Note privée : vérifier le journal avant de répondre.', visibility: 'internal' } });
    assert.equal(note.status, 201);
    assert.equal((await A.client.json(url, { method: 'POST', json: { body: 'Mon mot de passe : Azerty-2024!x', visibility: 'public' } })).body.code, 'SENSITIVE_CONTENT', 'staff cannot paste a secret either');
    assert.equal((await A.client.json(url, { method: 'POST', json: { body: '', visibility: 'public' } })).status, 400);
    assert.equal((await A.client.json(url, { method: 'POST', json: { body: 'x'.repeat(2001), visibility: 'public' } })).status, 400);
    assert.equal((await A.client.json(url, { method: 'POST', json: { body: 'ok', visibility: 'secret' } })).status, 400);

    const detail = (await A.client.json(`/api/admin/support/tickets/${ticket.id}`)).body;
    assert.deepEqual(detail.messages.map((m: any) => m.visibility), ['public', 'internal']);
    assert.equal(detail.ticket.awaitingStaff, false, 'handled');
    assert.ok(detail.ticket.firstResponseAt, 'the first response time is recorded');

    // the author's view
    const own = await owner.client.json(`/api/account/support/tickets/${ticket.id}`);
    assert.equal(own.status, 200);
    assert.deepEqual(own.body.messages.map((m: any) => m.senderType), ['user', 'staff']);
    assert.equal(own.text.includes('Note privée'), false, 'private notes never reach the author');
    assert.equal(own.text.includes('Sadmin'), false, 'staff appear as "Équipe de support", not by name');
    assert.equal(own.body.messages[1].authorName, 'Équipe de support');
    for (const hidden of ['adminNote', 'priority', 'assignedTo', 'ipHash']) assert.equal(own.text.includes(hidden), false, `no ${hidden}`);
    assert.ok((await owner.client.json('/api/notifications?limit=30')).body.notifications.some((n: any) => n.type === 'ticket_reply' && n.href === `/account/support/${ticket.id}`), 'the author is notified of the reply');
    assert.equal((await owner.client.json('/api/account/support/tickets')).body.tickets.find((t: any) => t.id === ticket.id).answered, true);

    // a ticket sent without an account has no delivery channel
    await submit(new Client(), `${subject} invité`);
    const guest = await findTicket(A.client, `${subject} invité`);
    const refused = await A.client.json(`/api/admin/support/tickets/${guest.id}/messages`, { method: 'POST', json: { body: 'Bonjour, voici notre réponse.', visibility: 'public' } });
    assert.equal(refused.status, 409);
    assert.equal(refused.body.code, 'NO_DELIVERY_CHANNEL');
    assert.equal((await A.client.json(`/api/admin/support/tickets/${guest.id}/messages`, { method: 'POST', json: { body: 'Contacté par téléphone, à suivre.', visibility: 'internal' } })).status, 201, 'a private note is still possible');
    assert.equal((await A.client.json(`/api/admin/support/tickets/${ticket.id}/messages`, { method: 'POST', json: { body: 'Réponse', visibility: 'internal' }, headers: { origin: 'https://evil.example' } })).status, 403, 'cross-site refused');
  });

  it('gives members a secure view of their own tickets and conversation', adminOnly, async () => {
    const owner = await member('conv-owner');
    const stranger = await member('conv-stranger');
    const subject = `Conversation${run}`;
    await submit(owner.client, subject);
    const guestSubject = `${subject} invité`;
    await submit(new Client(), guestSubject);
    const ticket = await findTicket(A.client, subject);
    const guest = await findTicket(A.client, guestSubject);

    const list = (await owner.client.json('/api/account/support/tickets')).body.tickets;
    assert.deepEqual(list.map((t: any) => t.subject), [subject], 'only the member\'s own ticket; the guest ticket is not linked to anyone');
    assert.equal((await stranger.client.json('/api/account/support/tickets')).body.tickets.length, 0);
    for (const intruder of [stranger.client, new Client()]) {
      const attempt = await intruder.json(`/api/account/support/tickets/${ticket.id}`);
      assert.ok([401, 404].includes(attempt.status), `another account cannot read it (${attempt.status})`);
    }
    assert.equal((await stranger.client.json(`/api/account/support/tickets/${ticket.id}/messages`, { method: 'POST', json: { body: 'Je me fais passer pour lui.' } })).status, 404);
    assert.equal((await owner.client.json(`/api/account/support/tickets/${guest.id}`)).status, 404, 'a guest ticket is not reachable by reference alone, even for a signed-in member');
    assert.equal((await new Client().json('/api/account/support/tickets')).status, 401);

    const url = `/api/account/support/tickets/${ticket.id}/messages`;
    const sent = await owner.client.json(url, { method: 'POST', json: { body: 'Voici un complément d’information.' } });
    assert.equal(sent.status, 201);
    assert.equal((await owner.client.json(url, { method: 'POST', json: { body: 'Voici un complément d’information.' } })).body.code, 'DUPLICATE');
    assert.equal((await owner.client.json(url, { method: 'POST', json: { body: 'Mon code PIN est 7392' } })).body.code, 'SENSITIVE_CONTENT');
    assert.equal((await owner.client.json(url, { method: 'POST', json: { body: '' } })).status, 400);
    assert.equal((await owner.client.json(url, { method: 'POST', json: { body: 'ok', userId: 'x' } })).status, 400, 'strict body');
    assert.equal((await owner.client.json(url, { method: 'POST', json: { body: 'ok merci' }, headers: { origin: 'https://evil.example' } })).status, 403);
    assert.ok((await adminNotes(B.client)).notifications.some((n: any) => n.type === 'admin_user_reply' && n.href === `/admin/support/tickets/${ticket.id}`), 'administrators are notified of a user reply');
    assert.equal((await A.client.json(`/api/admin/support/tickets/${ticket.id}`)).body.ticket.awaitingStaff, true, 'awaiting staff again');

    // a message on a finished ticket reopens it
    assert.equal((await patch(A.client, ticket.id, { status: 'resolved' })).status, 200);
    const reopened = await owner.client.json(url, { method: 'POST', json: { body: 'Le problème est revenu, pouvez-vous regarder ?' } });
    assert.equal(reopened.body.reopened, true);
    assert.equal((await A.client.json(`/api/admin/support/tickets/${ticket.id}`)).body.ticket.status, 'open');
    assert.ok((await adminNotes(B.client)).notifications.some((n: any) => n.type === 'admin_reopened' && n.href.endsWith(ticket.id)));
  });

  it('limits follow-up messages, including a parallel burst', adminOnly, async () => {
    const owner = await member('burst-owner');
    const subject = `Rafale${run}`;
    await submit(owner.client, subject);
    const ticket = await findTicket(A.client, subject);
    const url = `/api/account/support/tickets/${ticket.id}/messages`;
    const results = await Promise.all(Array.from({ length: 16 }, (_, i) => owner.client.json(url, { method: 'POST', json: { body: `Message numéro ${i} pour tester la limite d’envoi.` } })));
    const stored = results.filter((r) => r.status === 201).length;
    assert.ok(stored <= 10, `${stored} messages were stored`);
    assert.ok(stored >= 5);
    assert.ok(results.filter((r) => r.status === 429).length >= 6, 'the rest were refused');
    const detail = (await A.client.json(`/api/admin/support/tickets/${ticket.id}`)).body;
    assert.equal(detail.messages.length, stored, 'refused messages were not kept');
  });

  it('notifies administrators of new tickets, lists only support events, and honours preferences', adminOnly, async () => {
    const countNew = async (client: Client) => (await adminNotes(client)).notifications.filter((n: any) => n.type === 'admin_ticket_new').length;
    const [a0, b0] = [await countNew(A.client), await countNew(B.client)];
    await submit(new Client(), `Nouvelle${run} un`);
    assert.deepEqual([await countNew(A.client) - a0, await countNew(B.client) - b0], [1, 1], 'every administrator is told');
    const first = (await adminNotes(A.client)).notifications.find((n: any) => n.type === 'admin_ticket_new');
    assert.match(first.href, /^\/admin\/support\/tickets\/c[a-z0-9]+$/);
    assert.ok((await adminNotes(A.client)).notifications.every((n: any) => n.type.startsWith('admin_')), 'the support list only has support events');

    // personal notifications are not touched by "mark all as read"
    await A.client.json('/api/account/password', { method: 'POST', json: { currentPassword: PASSWORD, newPassword: 'Another-Strong-Pass-42', confirmPassword: 'Another-Strong-Pass-42' } });
    assert.ok((await A.client.json('/api/notifications/unread-count')).body.unreadCount > 0);
    const marked = await A.client.json('/api/admin/support/notifications/read-all', { method: 'POST', json: {} });
    assert.equal(marked.status, 200);
    assert.equal((await adminNotes(A.client, 'unread')).unreadCount, 0);
    assert.ok((await A.client.json('/api/notifications?filter=unread')).body.notifications.some((n: any) => n.type === 'password_changed'), 'the personal notification stayed unread');
    assert.equal((await A.client.json('/api/admin/support/me')).body.unreadNotifications, 0);

    // preferences
    const off = await B.client.json('/api/admin/support/settings/preferences', { method: 'PUT', json: { notifyNewTicket: false } });
    assert.equal(off.body.preferences.notifyNewTicket, false);
    const [a1, b1] = [await countNew(A.client), await countNew(B.client)];
    await submit(new Client(), `Nouvelle${run} deux`);
    assert.deepEqual([await countNew(A.client) - a1, await countNew(B.client) - b1], [1, 0], 'B switched this event off');
    assert.equal((await B.client.json('/api/admin/support/settings/preferences', { method: 'PUT', json: { notifyNewTicket: true } })).status, 200);
    for (const bad of [{}, { notifyEverything: true }, { notifyNewTicket: 'yes' }]) assert.equal((await B.client.json('/api/admin/support/settings/preferences', { method: 'PUT', json: bad })).status, 400, JSON.stringify(bad));
    assert.equal((await B.client.json('/api/admin/support/settings')).body.preferences.notifyNewTicket, true, 'persisted');
  });

  it('manages the contact-form categories, and the public form follows', adminOnly, async () => {
    const publicIds = async () => (await new Client().json('/api/support/categories')).body.categories.map((c: any) => c.id);
    assert.deepEqual(await publicIds(), ['login', 'profiles', 'catalog', 'list', 'privacy', 'technical', 'other']);
    const id = `cat-${run}`.slice(0, 28);
    assert.equal((await A.client.json('/api/admin/support/categories', { method: 'POST', json: { id, label: 'Facturation' } })).status, 201);
    assert.equal((await A.client.json('/api/admin/support/categories', { method: 'POST', json: { id, label: 'Autre' } })).status, 409, 'duplicate');
    assert.equal((await A.client.json('/api/admin/support/categories', { method: 'POST', json: { id: 'login', label: 'Autre' } })).status, 409, 'cannot reuse a built-in id');
    assert.equal((await A.client.json('/api/admin/support/categories', { method: 'POST', json: { id: 'Bad Id!', label: 'x' } })).status, 400);
    assert.ok((await publicIds()).includes(id), 'the new category appears on the public form');
    assert.equal((await submit(new Client(), `Catégorie neuve${run}`, { category: id })).status, 201, 'and tickets accept it');
    assert.equal((await submit(new Client(), `Catégorie inconnue${run}`, { category: 'inexistante' })).status, 400, 'an unknown category is refused');

    assert.equal((await A.client.json('/api/admin/support/categories/other', { method: 'PATCH', json: { label: 'Autre sujet' } })).status, 200);
    assert.equal((await new Client().json('/api/support/categories')).body.categories.find((c: any) => c.id === 'other').label, 'Autre sujet');
    assert.equal((await A.client.json('/api/admin/support/categories/other', { method: 'PATCH', json: { enabled: false } })).status, 200);
    assert.equal((await publicIds()).includes('other'), false, 'a disabled category leaves the form');
    assert.equal((await submit(new Client(), `Catégorie coupée${run}`, { category: 'other' })).status, 400);
    assert.ok((await listAll(A.client, 'category=other')).tickets !== undefined, 'existing tickets of a disabled category stay filterable');
    // a move swaps a category with its neighbour in the full list (disabled ones included)
    const order = async () => (await A.client.json('/api/admin/support/categories')).body.categories.map((c: any) => c.id);
    const before = await order();
    assert.equal((await A.client.json(`/api/admin/support/categories/${before[before.length - 1]}`, { method: 'PATCH', json: { move: 'up' } })).status, 200);
    const after = await order();
    assert.deepEqual([after[after.length - 2], after[after.length - 1]], [before[before.length - 1], before[before.length - 2]], 'moved up one place');
    assert.equal((await A.client.json(`/api/admin/support/categories/${after[0]}`, { method: 'PATCH', json: { move: 'up' } })).status, 200, 'moving the first one up changes nothing');
    assert.deepEqual(await order(), after);
    assert.equal((await A.client.json('/api/admin/support/categories/other', { method: 'PATCH', json: { enabled: true } })).status, 200);
    assert.equal((await A.client.json('/api/admin/support/categories/nope', { method: 'PATCH', json: { enabled: false } })).status, 404);
    for (const bad of [{}, { label: 'x' }, { move: 'sideways' }, { id: 'new' }]) assert.equal((await A.client.json('/api/admin/support/categories/other', { method: 'PATCH', json: bad })).status, 400, JSON.stringify(bad));
    // the last enabled category cannot be switched off
    const all = (await A.client.json('/api/admin/support/categories')).body.categories.filter((c: any) => c.enabled).map((c: any) => c.id);
    let last = 0;
    for (const target of all.slice(0, -1)) assert.equal((await A.client.json(`/api/admin/support/categories/${target}`, { method: 'PATCH', json: { enabled: false } })).status, 200);
    last = (await A.client.json(`/api/admin/support/categories/${all[all.length - 1]}`, { method: 'PATCH', json: { enabled: false } })).status;
    assert.equal(last, 409, 'at least one category stays enabled');
    for (const target of all.slice(0, -1)) await A.client.json(`/api/admin/support/categories/${target}`, { method: 'PATCH', json: { enabled: true } });
  });

  it('shows availability only when it was explicitly configured', adminOnly, async () => {
    const publicAvailability = async () => (await new Client().json('/api/support/categories')).body.availability;
    assert.equal(await publicAvailability(), null, 'nothing is invented by default');
    assert.equal((await A.client.json('/api/admin/support/settings/availability', { method: 'PUT', json: { enabled: true, text: '' } })).status, 400);
    assert.equal((await A.client.json('/api/admin/support/settings/availability', { method: 'PUT', json: { enabled: true, text: 'x'.repeat(301) } })).status, 400);
    assert.equal((await A.client.json('/api/admin/support/settings/availability', { method: 'PUT', json: { enabled: true, text: 'Nous répondons en général sous quelques jours ouvrés.' } })).status, 200);
    assert.deepEqual(await publicAvailability(), { text: 'Nous répondons en général sous quelques jours ouvrés.' });
    const help = await new Client().request('/help');
    assert.ok((await help.text()).includes('Nous répondons en général sous quelques jours ouvrés.'), 'shown on the Help Center');
    assert.equal((await A.client.json('/api/admin/support/settings/availability', { method: 'PUT', json: { enabled: false, text: 'Nous répondons en général sous quelques jours ouvrés.' } })).status, 200);
    assert.equal(await publicAvailability(), null, 'switched off again');
  });

  it('keeps every built-in Help Center article and FAQ, and publishes only what staff publish', adminOnly, async () => {
    const guest = new Client();
    const listing = (await A.client.json('/api/admin/support/kb/articles')).body.articles;
    assert.equal(listing.filter((a: any) => a.origin === 'builtin').length, HELP_ARTICLES.length, 'all built-in articles are listed');
    assert.ok(listing.every((a: any) => a.state === 'published' && a.live));
    const faqs = (await A.client.json('/api/admin/support/kb/faqs')).body.faqs;
    assert.equal(faqs.filter((f: any) => f.origin === 'builtin').length, HELP_FAQ.length);
    const html = await (await guest.request('/help')).text();
    assert.ok(html.includes(HELP_ARTICLES[0].title) || html.includes('Pour commencer'), 'the public Help Center renders');
    assert.equal((await guest.request(`/help/${HELP_ARTICLES[0].slug}`)).status, 200);

    // a NEW article: draft = invisible, published = visible, unpublished = invisible again
    const slug = `guide-${run}`;
    const created = await A.client.json('/api/admin/support/kb/articles', { method: 'POST', json: { slug, title: `Guide de test ${run}`, category: 'technique', summary: 'Un guide créé pour les tests.', content: '## Étape\nPremier paragraphe de test.\n\n1. Ouvrir la page\n2. Cliquer\n\n- une puce\n\n> Note : une information\n> Attention : un avertissement', keywords: ['guide', 'essai'], links: [{ label: 'Mon compte', href: '/account' }], status: 'draft' } });
    assert.equal(created.status, 201);
    assert.equal((await guest.request(`/help/${slug}`)).status, 404, 'a draft is not public');
    assert.equal((await (await guest.request('/help')).text()).includes(`Guide de test ${run}`), false);
    const draft = (await A.client.json(`/api/admin/support/kb/articles/${slug}`)).body.article;
    assert.deepEqual([draft.origin, draft.state, draft.live], ['custom', 'draft', false]);
    assert.match(draft.content, /^## Étape/);
    assert.equal((await A.client.json(`/api/admin/support/kb/articles/${slug}`, { method: 'PATCH', json: { status: 'published' } })).status, 200);
    const published = await guest.request(`/help/${slug}`);
    assert.equal(published.status, 200);
    const publishedHtml = await published.text();
    assert.ok(publishedHtml.includes(`Guide de test ${run}`) && publishedHtml.includes('Premier paragraphe de test.'));
    assert.ok((await (await guest.request('/help')).text()).includes(`Guide de test ${run}`), 'listed and searchable on the Help Center');
    assert.equal((await A.client.json(`/api/admin/support/kb/articles/${slug}`, { method: 'PATCH', json: { status: 'draft' } })).status, 200);
    assert.equal((await guest.request(`/help/${slug}`)).status, 404, 'unpublished');

    // invalid input
    const base = { title: `Autre guide ${run}`, category: 'technique', summary: 'Un autre guide pour les tests.', content: 'Un paragraphe suffisant.', status: 'draft' };
    assert.equal((await A.client.json('/api/admin/support/kb/articles', { method: 'POST', json: { ...base, slug: HELP_ARTICLES[0].slug } })).body.code, 'SLUG_RESERVED', 'cannot shadow a built-in article');
    assert.equal((await A.client.json('/api/admin/support/kb/articles', { method: 'POST', json: { ...base, slug } })).status, 409);
    for (const bad of [{ content: '' }, { title: 'abc' }, { category: 'inconnue' }, { links: [{ label: 'x', href: 'https://evil.example' }] }, { links: [{ label: 'x', href: '//evil.example' }] }, { slug: 'Not A Slug' }, { status: 'weird' }, { owner: 'me' }]) {
      assert.equal((await A.client.json('/api/admin/support/kb/articles', { method: 'POST', json: { ...base, ...bad } })).status, 400, JSON.stringify(bad));
    }
    // markup is stored and shown as text, never as HTML
    const xss = `xss-${run}`;
    assert.equal((await A.client.json('/api/admin/support/kb/articles', { method: 'POST', json: { ...base, slug: xss, title: `Titre <script>alert(1)</script> ${run}`, content: '<img src=x onerror=alert(1)>', status: 'published' } })).status, 201);
    const xssHtml = await (await guest.request(`/help/${xss}`)).text();
    assert.equal(xssHtml.includes('<img src=x onerror'), false, 'no raw markup');
    assert.equal(xssHtml.includes('<script>alert(1)</script>'), false);
    assert.ok(xssHtml.includes('&lt;img src=x onerror=alert(1)&gt;'), 'shown as text');
    assert.equal((await A.client.json(`/api/admin/support/kb/articles/${xss}`, { method: 'DELETE' })).status, 200);
    assert.equal((await A.client.json(`/api/admin/support/kb/articles/${slug}`, { method: 'DELETE' })).status, 200);
    assert.equal((await A.client.json(`/api/admin/support/kb/articles/${slug}`)).status, 404);
  });

  it('overrides, hides and restores a built-in article without ever losing the original', adminOnly, async () => {
    const guest = new Client();
    const target = HELP_ARTICLES.find((article) => article.slug === 'creer-un-compte')!;
    const publicTitle = async () => { const res = await guest.request(`/help/${target.slug}`); return { status: res.status, html: await res.text() }; };
    assert.ok((await publicTitle()).html.includes(target.title));
    const edit = { title: `${target.title} (version révisée)`, category: target.category, summary: 'Un résumé révisé pour le test.', content: 'Un contenu révisé, suffisamment long pour être accepté.', keywords: [], links: [], status: 'draft' };
    assert.equal((await A.client.json(`/api/admin/support/kb/articles/${target.slug}`, { method: 'PUT', json: edit })).status, 200);
    const during = (await A.client.json(`/api/admin/support/kb/articles/${target.slug}`)).body.article;
    assert.deepEqual([during.origin, during.overridden, during.state, during.live], ['builtin', true, 'draft', true]);
    assert.ok((await publicTitle()).html.includes(target.title) && !(await publicTitle()).html.includes('version révisée'), 'a draft keeps the built-in text live');
    assert.equal((await A.client.json(`/api/admin/support/kb/articles/${target.slug}`, { method: 'PATCH', json: { status: 'published' } })).status, 200);
    assert.ok((await publicTitle()).html.includes('version révisée'), 'published: the revised text is live');
    assert.equal((await A.client.json(`/api/admin/support/kb/articles/${target.slug}`, { method: 'PATCH', json: { status: 'archived' } })).status, 200);
    assert.equal((await publicTitle()).status, 404, 'hidden');
    assert.equal((await A.client.json('/api/admin/support/kb/articles/creer-un-profil', { method: 'DELETE' })).body.code, 'BUILTIN', 'an untouched built-in article cannot be deleted');
    const restored = await A.client.json(`/api/admin/support/kb/articles/${target.slug}`, { method: 'DELETE' });
    assert.deepEqual([restored.status, restored.body.restored], [200, true]);
    const back = await publicTitle();
    assert.ok(back.status === 200 && back.html.includes(target.title) && !back.html.includes('version révisée'), 'the original is back, unchanged');
    assert.equal((await A.client.json(`/api/admin/support/kb/articles/${target.slug}`, { method: 'PUT', json: { ...edit, slug: 'other-slug' } })).status, 400, 'the address cannot change');
  });

  it('manages FAQ entries: add, edit, hide, reorder, restore', adminOnly, async () => {
    const guest = new Client();
    const builtin = HELP_FAQ[0];
    const created = await A.client.json('/api/admin/support/kb/faqs', { method: 'POST', json: { question: `Une question de test ${run} ?`, answer: 'Une réponse de test suffisamment longue.', category: 'technique', status: 'published' } });
    assert.equal(created.status, 201);
    const key = created.body.key;
    assert.ok((await (await guest.request('/help')).text()).includes(`Une question de test ${run}`), 'a published question is public');
    assert.equal((await A.client.json(`/api/admin/support/kb/faqs/${key}`, { method: 'PATCH', json: { status: 'draft' } })).status, 200);
    assert.equal((await (await guest.request('/help')).text()).includes(`Une question de test ${run}`), false, 'a draft is not');

    // a built-in question: edit (override), hide, restore
    const edit = { question: 'Question révisée du test ?', answer: 'Réponse révisée, assez longue pour être acceptée.', category: builtin.category, keywords: [], links: [], status: 'published' };
    assert.equal((await A.client.json(`/api/admin/support/kb/faqs/${builtin.id}`, { method: 'PUT', json: edit })).status, 200);
    assert.ok((await (await guest.request('/help')).text()).includes('Question révisée du test'));
    assert.equal((await A.client.json(`/api/admin/support/kb/faqs/${builtin.id}`, { method: 'PATCH', json: { status: 'archived' } })).status, 200);
    let html = await (await guest.request('/help')).text();
    assert.equal(html.includes('Question révisée du test') || html.includes(builtin.question), false, 'hidden');
    assert.equal((await A.client.json(`/api/admin/support/kb/faqs/${builtin.id}`, { method: 'DELETE' })).body.restored, true);
    html = await (await guest.request('/help')).text();
    assert.ok(html.includes(builtin.question.slice(0, 20)), 'the original question is back');

    // order: saved, validated, reflected in the list
    const current = (await A.client.json('/api/admin/support/kb/faqs')).body.faqs.map((f: any) => f.key);
    const reversed = [...current].reverse();
    assert.equal((await A.client.json('/api/admin/support/kb/faqs/order', { method: 'PUT', json: { keys: reversed } })).status, 200);
    assert.deepEqual((await A.client.json('/api/admin/support/kb/faqs')).body.faqs.map((f: any) => f.key), reversed);
    assert.equal((await A.client.json('/api/admin/support/kb/faqs/order', { method: 'PUT', json: { keys: [...reversed, 'nope'] } })).status, 400);
    assert.equal((await A.client.json('/api/admin/support/kb/faqs/order', { method: 'PUT', json: { keys: [reversed[0], reversed[0]] } })).status, 400, 'no repeats');
    await A.client.json('/api/admin/support/kb/faqs/order', { method: 'PUT', json: { keys: current } });
    assert.equal((await A.client.json(`/api/admin/support/kb/faqs/${key}`, { method: 'DELETE' })).status, 200);
    for (const bad of [{ question: 'x', answer: 'y', category: 'technique' }, { question: 'Une question valable ?', answer: 'Une réponse valable.', category: 'inconnue' }]) assert.equal((await A.client.json('/api/admin/support/kb/faqs', { method: 'POST', json: bad })).status, 400);
  });

  it('computes analytics from real records and reports unmeasurable metrics honestly', adminOnly, async () => {
    const day = new Date().toISOString().slice(0, 10);
    const query = (extra = '') => `from=${day}&to=${day}${extra}`;
    const analytics = async (extra = '') => (await A.client.json(`/api/admin/support/analytics?${query(extra)}`)).body;
    const base = await analytics();
    const owner = await member('analytics-owner');
    const subject = `Analyse${run}`;
    await submit(owner.client, subject, { category: 'privacy' });
    await submit(new Client(), `${subject} 2`, { category: 'privacy' });
    const ticket = await findTicket(A.client, subject);
    const after = await analytics();
    assert.equal(after.total - base.total, 2, 'two new tickets counted');
    assert.equal(after.series.reduce((sum: number, point: any) => sum + point.count, 0), after.total, 'the series adds up to the total');
    assert.equal(after.byStatus.open - base.byStatus.open, 2);
    assert.equal(after.byCategory.find((c: any) => c.category === 'privacy').count - (base.byCategory.find((c: any) => c.category === 'privacy')?.count ?? 0), 2);
    assert.equal(Object.values(after.byStatus).reduce((sum: number, n: any) => sum + n, 0), after.total);
    assert.equal(after.resolvedVersusUnresolved.resolved + after.resolvedVersusUnresolved.unresolved, after.total);

    // response and resolution times only exist once the data to measure them exists
    const frBefore = after.firstResponse.sample;
    const resBefore = after.resolution.sample;
    assert.equal((await A.client.json(`/api/admin/support/tickets/${ticket.id}/messages`, { method: 'POST', json: { body: 'Bonjour, nous avons bien reçu votre demande.', visibility: 'public' } })).status, 201);
    assert.equal((await patch(A.client, ticket.id, { status: 'resolved' })).status, 200);
    const measured = await analytics();
    assert.equal(measured.firstResponse.sample - frBefore, 1, 'one first response was recorded');
    assert.equal(measured.resolution.sample - resBefore, 1, 'one resolution was recorded');
    assert.equal(measured.firstResponse.available, true);
    assert.ok(measured.firstResponse.seconds >= 0 && measured.resolution.seconds >= 0);
    assert.equal((await analytics('&granularity=week')).range.granularity, 'week');
    assert.equal((await analytics('&granularity=month')).series.length >= 1, true);
    const empty = (await A.client.json('/api/admin/support/analytics?from=2001-01-01&to=2001-01-31')).body;
    assert.deepEqual([empty.total, empty.firstResponse.available, empty.resolution.available, empty.firstResponse.seconds], [0, false, false, null], 'no data: unavailable, not zero');
    assert.equal(empty.series.length, 31, 'a continuous daily series, with zeros');
    for (const bad of ['from=2026-02-01&to=2026-01-01', 'from=2020-01-01&to=2026-01-01', 'granularity=hour', 'from=nope']) assert.equal((await A.client.json(`/api/admin/support/analytics?${bad}`)).status, 400, bad);
  });

  it('shows an overview built from the database', adminOnly, async () => {
    const overview = (await A.client.json('/api/admin/support/overview')).body;
    const k = overview.kpis;
    assert.equal(k.open + k.in_progress + k.resolved + k.closed, k.total, 'the counters add up');
    assert.ok(k.toHandle >= 0 && k.toHandle <= k.open + k.in_progress);
    assert.equal((await listAll(A.client)).total, k.total, 'the same total as the ticket list');
    assert.ok(overview.recent.length > 0 && overview.recent.length <= 6);
    assert.ok(overview.recent.every((t: any) => !('email' in t) && !('message' in t)), 'no personal text in the overview');
    assert.ok(overview.attention.every((t: any) => t.awaitingStaff && ['open', 'in_progress'].includes(t.status)));
    assert.ok(overview.highPriority.every((t: any) => ['high', 'urgent'].includes(t.priority)));
    assert.ok(overview.activity.length > 0 && overview.activity.every((a: any) => a.actorName));
    assert.equal(overview.byCategory.reduce((sum: number, c: any) => sum + c.count, 0), k.total);
    assert.equal(overview.byPriority.reduce((sum: number, c: any) => sum + c.count, 0), k.total);
  });

  it('keeps a read-only audit log without secrets, and removing an administrator does not erase it', adminOnly, async () => {
    const audit = (await A.client.json('/api/admin/support/audit')).body;
    assert.ok(audit.total > 5);
    const actions = new Set(audit.entries.map((e: any) => e.action));
    assert.ok(['ticket.status_changed', 'ticket.assigned', 'ticket.reply'].some((a) => actions.has(a)));
    const dump = JSON.stringify(audit);
    for (const forbidden of ['Bonjour, nous', 'Note privée', 'Azerty', 'passwordHash', PASSWORD, 'cookie', 'token']) assert.equal(dump.includes(forbidden), false, `no "${forbidden}" in the audit log`);
    assert.ok(audit.entries.every((e: any) => e.metadata === null || Object.values(e.metadata).every((v) => ['string', 'number', 'boolean'].includes(typeof v) || v === null)), 'metadata is small and flat');
    assert.ok((await A.client.json('/api/admin/support/audit?action=ticket.')).body.entries.every((e: any) => e.action.startsWith('ticket.')), 'filter by action prefix');
    for (const method of ['PUT', 'PATCH', 'DELETE', 'POST']) assert.equal((await A.client.json('/api/admin/support/audit', { method, json: {} })).status, 405, `${method} is not offered`);
    assert.equal((await A.client.json('/api/admin/support/audit?page=0')).status, 400);

    // an administrator whose account is deleted: the log keeps their entries (actor cleared) and the deletion is not blocked
    const temp = await member('temp-admin');
    execSync(GRANT, { env: { ...process.env, ADMIN_EMAIL: `${A.email},${B.email},${temp.email}` }, stdio: 'ignore' });
    await A.client.login(A.email, PASSWORD); await B.client.login(B.email, PASSWORD); await temp.client.login(temp.email, PASSWORD);
    const subject = `Journal${run}`;
    await submit(new Client(), subject);
    const ticket = await findTicket(temp.client, subject);
    assert.equal((await patch(temp.client, ticket.id, { priority: 'low' })).status, 200);
    const mine = (await A.client.json('/api/admin/support/audit?action=ticket.priority')).body.entries.find((e: any) => e.resourceId === ticket.id);
    assert.equal(mine.actorName, 'Sadmin temp-admin');
    const removal = await temp.client.json('/api/account', { method: 'DELETE', json: { password: PASSWORD, confirmation: 'SUPPRIMER' } });
    assert.equal(removal.status, 200, 'deleting the account is not blocked by the append-only log');
    const kept = (await A.client.json('/api/admin/support/audit?action=ticket.priority')).body.entries.find((e: any) => e.resourceId === ticket.id);
    assert.ok(kept, 'the entry survived');
    assert.equal(kept.actorName, 'Compte supprimé');
  });

  it('deleting a ticket keeps only its reference in the log; deleting a member removes their tickets and conversation', adminOnly, async () => {
    const owner = await member('erase-owner');
    const subject = `Effacement${run}`;
    await submit(owner.client, subject);
    const ticket = await findTicket(A.client, subject);
    await A.client.json(`/api/admin/support/tickets/${ticket.id}/messages`, { method: 'POST', json: { body: 'Réponse destinée à être effacée.', visibility: 'public' } });
    assert.equal((await owner.client.json('/api/account', { method: 'DELETE', json: { password: PASSWORD, confirmation: 'SUPPRIMER' } })).status, 200);
    assert.equal(await findTicket(A.client, subject), undefined, 'the ticket left with the account');
    assert.equal((await A.client.json(`/api/admin/support/tickets/${ticket.id}`)).status, 404);

    const other = await member('erase-other');
    await submit(other.client, `${subject} suppression`);
    const second = await findTicket(A.client, `${subject} suppression`);
    const gone = await A.client.json(`/api/admin/support/tickets/${second.id}`, { method: 'DELETE' });
    assert.equal(gone.status, 200);
    const entry = (await A.client.json('/api/admin/support/audit?action=ticket.deleted')).body.entries.find((e: any) => e.resourceId === second.id);
    assert.deepEqual(entry.metadata, { reference: second.reference }, 'only the reference is kept');
    assert.equal((await other.client.json(`/api/account/support/tickets/${second.id}`)).status, 404);
    assert.equal((await A.client.json(`/api/admin/support/tickets/${second.id}`, { method: 'DELETE' })).status, 404);
  });

  it('lists the support team read-only, with no way to grant access', adminOnly, async () => {
    const staff = (await A.client.json('/api/admin/support/staff')).body.staff;
    assert.ok(staff.some((s: any) => s.email === A.email && s.you) && staff.some((s: any) => s.email === B.email && !s.you));
    assert.ok(staff.every((s: any) => s.role === 'Administrateur du support' && typeof s.openAssigned === 'number'));
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.equal((await A.client.json('/api/admin/support/staff', { method, json: { email: B.email } })).status, 405, `${method} /staff is not offered`);
    assert.equal(JSON.stringify(staff).includes('isSupportAdmin'), false);
  });
});
