import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { digitsOnly, pinProblem } from '../src/lib/pin-rules';
import { readUnlockToken, signUnlockToken, UNLOCK_MAX_AGE_SECONDS } from '../src/lib/unlock-token';

describe('profile PIN rules', () => {
  it('accepts ordinary 4-digit codes', () => {
    for (const pin of ['7392', '4821', '0907', '5038', '2951']) assert.equal(pinProblem(pin), null, pin);
  });

  it('refuses anything that is not exactly four digits', () => {
    for (const pin of ['', '123', '12345', 'abcd', '12a4', ' 1234', '٣٣٣٣', '12.4']) assert.ok(pinProblem(pin), `"${pin}" should be refused`);
  });

  it('refuses default and trivially guessable codes, including 0000 and 1234', () => {
    for (const pin of ['0000', '1234', '1111', '9999', '4321', '2345', '6789', '8765', '3210', '0123', '1212', '2580', '1122']) assert.ok(pinProblem(pin), `${pin} should be refused`);
  });

  it('cleans pasted or typed input down to at most four digits', () => {
    assert.equal(digitsOnly('1 2-3 4'), '1234');
    assert.equal(digitsOnly('98765'), '9876');
    assert.equal(digitsOnly('ab'), '');
  });
});

describe('profile unlock token', () => {
  const secret = 'unit-test-secret-not-a-real-secret-0123456789';
  const claim = { sid: 'session-1', userId: 'user-1', profileId: 'profile-1' };

  it('round-trips the claim', () => {
    const parsed = readUnlockToken(secret, signUnlockToken(secret, claim));
    assert.ok(parsed);
    assert.deepEqual([parsed.s, parsed.u, parsed.p], ['session-1', 'user-1', 'profile-1']);
  });

  it('rejects a token signed with another secret, a tampered claim, a truncated token and garbage', () => {
    const token = signUnlockToken(secret, claim);
    assert.equal(readUnlockToken('another-secret-entirely-0123456789abcdef', token), null);
    const [body, signature] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64url').toString()), p: 'profile-2' })).toString('base64url');
    assert.equal(readUnlockToken(secret, `${forged}.${signature}`), null);
    assert.equal(readUnlockToken(secret, token.slice(0, -3)), null);
    for (const junk of ['', 'abc', 'a.b.c', '.', 'x.y', undefined, null]) assert.equal(readUnlockToken(secret, junk as string), null);
  });

  it('expires', () => {
    const issuedAt = 1_700_000_000_000;
    const token = signUnlockToken(secret, claim, issuedAt);
    assert.ok(readUnlockToken(secret, token, issuedAt + (UNLOCK_MAX_AGE_SECONDS - 5) * 1000));
    assert.equal(readUnlockToken(secret, token, issuedAt + (UNLOCK_MAX_AGE_SECONDS + 5) * 1000), null);
  });

  it('is bound to one profile, user and session (the caller compares them)', () => {
    const parsed = readUnlockToken(secret, signUnlockToken(secret, claim));
    assert.ok(parsed);
    assert.notEqual(parsed.s, 'another-session');
    assert.notEqual(parsed.p, 'profile-2');
  });
});

describe('profile PIN request schemas', () => {
  const base = { name: 'Alex', avatar: 'ember', isKids: false, maturityLevel: 18, preferences: [], language: 'fr-FR' };

  it('accept a good PIN and refuse letters, wrong lengths, and weak codes when setting one', async () => {
    const { pinSchema } = await import('../src/lib/validation');
    assert.ok(pinSchema.safeParse('7392').success);
    for (const pin of ['abcd', 'dddd', '12345', '123', '', '1234', '0000', '1111']) assert.equal(pinSchema.safeParse(pin).success, false, `"${pin}" must be refused`);
  });

  it('only checks the format when unlocking (a weak code must still be unlockable if it was set before)', async () => {
    const { pinUnlockSchema } = await import('../src/lib/validation');
    assert.ok(pinUnlockSchema.safeParse({ pin: '0000' }).success);
    assert.equal(pinUnlockSchema.safeParse({ pin: 'dddd' }).success, false);
    assert.equal(pinUnlockSchema.safeParse({ pin: '12' }).success, false);
  });

  it('delete requests accept the editor’s empty parental code but still need a password and a well-formed code', async () => {
    const { profileDeleteSchema } = await import('../src/lib/validation');
    assert.ok(profileDeleteSchema.safeParse({ password: 'pw', parentalPin: '' }).success);
    assert.ok(profileDeleteSchema.safeParse({ password: 'pw' }).success);
    assert.ok(profileDeleteSchema.safeParse({ password: 'pw', parentalPin: '4821' }).success);
    assert.equal(profileDeleteSchema.safeParse({ password: '', parentalPin: '' }).success, false);
    assert.equal(profileDeleteSchema.safeParse({ password: 'pw', parentalPin: 'abc' }).success, false);
  });

  it('require a PIN and its confirmation to create a profile', async () => {
    const { profileCreateSchema } = await import('../src/lib/validation');
    assert.ok(profileCreateSchema.safeParse({ ...base, pin: '7392', confirmPin: '7392' }).success);
    assert.equal(profileCreateSchema.safeParse(base).success, false, 'no PIN');
    assert.equal(profileCreateSchema.safeParse({ ...base, pin: '7392' }).success, false, 'no confirmation');
    assert.equal(profileCreateSchema.safeParse({ ...base, pin: '7392', confirmPin: '7391' }).success, false, 'mismatch');
    assert.equal(profileCreateSchema.safeParse({ ...base, pin: '1234', confirmPin: '1234' }).success, false, 'weak');
  });

  it('require the account password to edit or delete a profile, and a real change when editing', async () => {
    const { profilePatchSchema, profileDeleteSchema } = await import('../src/lib/validation');
    assert.ok(profilePatchSchema.safeParse({ name: 'New', password: 'x' }).success);
    assert.equal(profilePatchSchema.safeParse({ name: 'New' }).success, false, 'no password');
    assert.equal(profilePatchSchema.safeParse({ password: 'x' }).success, false, 'nothing to change');
    assert.ok(profileDeleteSchema.safeParse({ password: 'x' }).success);
    assert.equal(profileDeleteSchema.safeParse({}).success, false);
    assert.equal(profileDeleteSchema.safeParse({ password: 'x', parentalPin: 'abcd' }).success, false);
  });

  it('require matching confirmation when setting a PIN, with an optional password', async () => {
    const { pinSetSchema } = await import('../src/lib/validation');
    assert.ok(pinSetSchema.safeParse({ pin: '7392', confirmPin: '7392' }).success);
    assert.ok(pinSetSchema.safeParse({ pin: '7392', confirmPin: '7392', password: 'x' }).success);
    assert.equal(pinSetSchema.safeParse({ pin: '7392', confirmPin: '1111' }).success, false);
  });
});

describe('PIN pepper migration (PIN_PEPPER introduced after PINs were hashed with the AUTH_SECRET fallback)', () => {
  const LEGACY = 'legacy-auth-secret-value-for-tests-only';
  const NEW = 'dedicated-pin-pepper-for-tests-only-0123';
  const OTHER = 'some-other-pepper-for-tests-only-4567';
  const cost = 4; // fast bcrypt for tests; the production cost is 12

  it('a PIN hashed with the legacy secret still verifies after a new pepper is introduced, and is flagged for upgrade', async () => {
    const { hashPinWithPepper, verifyPinWithPeppers } = await import('../src/lib/pin-hash');
    const stored = await hashPinWithPepper(LEGACY, 'profile-1', '7392', cost);
    assert.equal(await verifyPinWithPeppers(NEW, [LEGACY], 'profile-1', '7392', stored), 'legacy');
    assert.equal(await verifyPinWithPeppers(NEW, [LEGACY], 'profile-1', '7391', stored), null, 'a wrong PIN still fails');
    assert.equal(await verifyPinWithPeppers(NEW, [], 'profile-1', '7392', stored), null, 'without the fallback the old hash no longer verifies');
  });

  it('after the upgrade the new hash verifies as current, with or without the fallback', async () => {
    const { hashPinWithPepper, verifyPinWithPeppers } = await import('../src/lib/pin-hash');
    const upgraded = await hashPinWithPepper(NEW, 'profile-1', '7392', cost);
    assert.equal(await verifyPinWithPeppers(NEW, [LEGACY], 'profile-1', '7392', upgraded), 'current');
    assert.equal(await verifyPinWithPeppers(NEW, [], 'profile-1', '7392', upgraded), 'current');
    assert.equal(await verifyPinWithPeppers(LEGACY, [], 'profile-1', '7392', upgraded), null, 'the legacy secret alone cannot verify an upgraded hash');
  });

  it('hashes are bound to the profile and to the pepper', async () => {
    const { hashPinWithPepper, verifyPinWithPeppers } = await import('../src/lib/pin-hash');
    const stored = await hashPinWithPepper(NEW, 'profile-1', '7392', cost);
    assert.equal(await verifyPinWithPeppers(NEW, [], 'profile-2', '7392', stored), null, 'another profile id');
    assert.equal(await verifyPinWithPeppers(OTHER, [], 'profile-1', '7392', stored), null, 'another pepper');
    assert.equal(await verifyPinWithPeppers(OTHER, [NEW], 'profile-1', '7392', stored), 'legacy', 'a later rotation keeps the previous pepper as a fallback');
  });
});
