import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NOTIFICATION_LIMITS, createRateLimiter, decodeCursor, encodeCursor, formatRelativeTime, isSafeInternalPath } from '../src/lib/notification-rules';
import { fingerprint, passwordChanged, pinLockout, pinSet, sessionsRevoked, ticketCreated, ticketStatusChanged, type NotificationDraft } from '../src/lib/notification-events';
import { announcementSchema, notificationListQuerySchema, notificationPreferencesSchema, notificationReadSchema } from '../src/lib/validation';

describe('notification destinations', () => {
  it('accepts pages inside CINEVERSE', () => {
    for (const path of ['/', '/account', '/help#contact', '/help/proteger-son-compte', '/films-series-catalog?type=tv&genre=28', '/profiles']) assert.equal(isSafeInternalPath(path), true, path);
  });

  it('refuses every external or tricky destination', () => {
    for (const path of ['//evil.example', 'https://evil.example', 'http://evil.example/x', 'javascript:alert(1)', '/javascript:alert(1)', '/\\evil.example', '/a b', '/a\nb', '', 'account', '/' + 'a'.repeat(NOTIFICATION_LIMITS.hrefMax), '/<script>', '/x"onload="y']) {
      assert.equal(isSafeInternalPath(path), false, JSON.stringify(path));
    }
    for (const value of [null, undefined, 42, {}]) assert.equal(isSafeInternalPath(value), false);
  });
});

describe('notification events', () => {
  const PIN = '7392';
  const PASSWORD = 'Correct-Horse-Battery-9';
  const drafts = (): NotificationDraft[] => [
    passwordChanged('$2b$12$exampleexampleexampleexampleexampleexampleexample00'),
    pinSet('cprofile00000001', 'Alex', '$2b$12$examplehashexamplehashexamplehashexamplehashexample', false),
    pinSet('cprofile00000001', 'Alex', '$2b$12$examplehashexamplehashexamplehashexamplehashexample', true),
    pinLockout('cprofile00000001', 'Alex'),
    sessionsRevoked('others'),
    sessionsRevoked('all'),
    ticketCreated('cticket0000000abcd1234', 'Écran bloqué'),
    ticketStatusChanged('cticket0000000abcd1234', 'resolved', 1760000000000),
    ticketStatusChanged('cticket0000000abcd1234', 'in_progress', 1760000000001),
    ticketStatusChanged('cticket0000000abcd1234', 'closed', 1760000000002),
  ];

  it('never put a password, a PIN, a hash or a token in a notification', () => {
    for (const draft of drafts()) {
      const text = `${draft.title} ${draft.message}`;
      for (const forbidden of [PIN, PASSWORD, '$2b$', 'eyJ', 'sessionToken', 'passwordHash', 'profilePinHash']) assert.equal(text.includes(forbidden), false, `${draft.type} contains ${forbidden}`);
      assert.ok(draft.title.length <= NOTIFICATION_LIMITS.titleMax && draft.message.length <= NOTIFICATION_LIMITS.messageMax, draft.type);
    }
  });

  it('only point to pages inside CINEVERSE, in a known category', () => {
    for (const draft of drafts()) {
      assert.equal(draft.href === null || isSafeInternalPath(draft.href), true, draft.type);
      assert.ok(['security', 'support'].includes(draft.category), 'events are essential categories');
    }
  });

  it('identify the event, so replaying it cannot notify twice but a new event can', () => {
    const first = passwordChanged('hash-one');
    assert.equal(passwordChanged('hash-one').dedupeKey, first.dedupeKey, 'the same password change replayed');
    assert.notEqual(passwordChanged('hash-two').dedupeKey, first.dedupeKey, 'a later change is a new event');
    const now = 1760000000000;
    assert.equal(pinLockout('p1', 'Alex', now).dedupeKey, pinLockout('p1', 'Alex', now + 5 * 60 * 1000).dedupeKey, 'repeated attempts in one lockout window');
    assert.notEqual(pinLockout('p1', 'Alex', now).dedupeKey, pinLockout('p1', 'Alex', now + 16 * 60 * 1000).dedupeKey, 'a lockout in a later window');
    assert.notEqual(pinLockout('p1', 'Alex', now).dedupeKey, pinLockout('p2', 'Alex', now).dedupeKey, 'another profile');
    assert.equal(ticketCreated('t1', 'a').dedupeKey, ticketCreated('t1', 'b').dedupeKey);
    assert.notEqual(ticketStatusChanged('t1', 'resolved', 1).dedupeKey, ticketStatusChanged('t1', 'closed', 1).dedupeKey);
    assert.match(fingerprint('anything'), /^[0-9a-f]{12}$/);
  });

  it('say the right thing for the right status', () => {
    assert.equal(ticketStatusChanged('cticket0000000abcd1234', 'resolved', 1).title, 'Demande résolue');
    assert.match(ticketStatusChanged('cticket0000000abcd1234', 'resolved', 1).message, /CV-ABCD1234/);
    assert.match(ticketStatusChanged('cticket0000000abcd1234', 'in_progress', 1).message, /En cours/);
    assert.equal(pinSet('p', 'Alex', 'h', true).title, 'Code PIN créé');
    assert.equal(pinSet('p', 'Alex', 'h', false).title, 'Code PIN modifié');
  });
});

describe('notification helpers', () => {
  it('round-trips the pagination cursor and refuses a forged one', () => {
    const at = new Date('2026-10-09T12:00:00.123Z');
    const cursor = encodeCursor(at, 'cabcdefghij1234567');
    assert.deepEqual(decodeCursor(cursor), { createdAt: at, id: 'cabcdefghij1234567' });
    for (const bad of ['', 'nope', '2026-10-09T12:00:00Z_', 'not-a-date_cabcdefghij1234567', `${at.toISOString()}_'; DROP TABLE`, null, undefined]) assert.equal(decodeCursor(bad as string | null | undefined), null, String(bad));
  });

  it('formats times in French', () => {
    const now = Date.parse('2026-10-09T12:00:00Z');
    const ago = (ms: number) => new Date(now - ms).toISOString();
    assert.equal(formatRelativeTime(ago(10_000), now), 'à l’instant');
    assert.match(formatRelativeTime(ago(5 * 60_000), now), /5 minutes/);
    assert.match(formatRelativeTime(ago(3 * 3600_000), now), /3 heures/);
    assert.equal(formatRelativeTime(ago(26 * 3600_000), now), 'hier');
    assert.match(formatRelativeTime(ago(3 * 86400_000), now), /3 jours/);
    assert.match(formatRelativeTime(ago(60 * 86400_000), now), /2026/);
  });

  it('limits a burst of requests and recovers after the window', () => {
    const limiter = createRateLimiter(3, 1000);
    const t = 1_000_000;
    assert.deepEqual([limiter('a', t).allowed, limiter('a', t + 1).allowed, limiter('a', t + 2).allowed], [true, true, true]);
    const blocked = limiter('a', t + 3);
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.retryAfterSeconds >= 1);
    assert.equal(limiter('b', t + 3).allowed, true, 'another key is independent');
    assert.equal(limiter('a', t + 1500).allowed, true, 'the window passed');
  });
});

describe('notification request schemas', () => {
  it('apply defaults and caps to the list query', () => {
    const parsed = notificationListQuerySchema.parse({});
    assert.deepEqual([parsed.filter, parsed.limit], ['all', NOTIFICATION_LIMITS.pageDefault]);
    assert.equal(notificationListQuerySchema.parse({ limit: '5', filter: 'unread' }).limit, 5);
    for (const bad of [{ limit: '0' }, { limit: String(NOTIFICATION_LIMITS.pageMax + 1) }, { limit: 'abc' }, { filter: 'everything' }]) assert.equal(notificationListQuerySchema.safeParse(bad).success, false, JSON.stringify(bad));
  });

  it('are strict for reading and preferences', () => {
    assert.ok(notificationReadSchema.safeParse({ read: true }).success);
    assert.equal(notificationReadSchema.safeParse({ read: 'yes' }).success, false);
    assert.equal(notificationReadSchema.safeParse({ read: true, userId: 'x' }).success, false);
    assert.ok(notificationPreferencesSchema.safeParse({ catalogue: false }).success);
    assert.equal(notificationPreferencesSchema.safeParse({}).success, false);
    assert.equal(notificationPreferencesSchema.safeParse({ security: false }).success, false, 'security cannot be configured');
    assert.equal(notificationPreferencesSchema.safeParse({ support: false }).success, false, 'support updates cannot be configured');
  });

  it('validate announcements, including the destination', () => {
    const good = { category: 'catalogue', title: 'Nouveautés de la semaine', message: 'Trois films viennent d’arriver.', href: '/films-series-catalog' };
    assert.ok(announcementSchema.safeParse(good).success);
    assert.ok(announcementSchema.safeParse({ ...good, href: '' }).success);
    assert.ok(announcementSchema.safeParse({ ...good, href: undefined }).success);
    for (const bad of [{ href: 'https://evil.example' }, { href: '//evil.example' }, { href: 'javascript:alert(1)' }, { category: 'security' }, { category: 'support' }, { title: 'ab' }, { message: 'abc' }, { title: 'x'.repeat(121) }, { message: 'x'.repeat(401) }, { userId: 'everyone' }]) {
      assert.equal(announcementSchema.safeParse({ ...good, ...bad }).success, false, JSON.stringify(bad).slice(0, 50));
    }
  });
});
