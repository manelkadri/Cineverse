import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { accountDeleteSchema, accountExportSchema, accountNameSchema, passwordChangeSchema, sessionRevokeSchema } from '../src/lib/validation';

describe('account request schemas', () => {
  const good = { currentPassword: 'Old-Password-123', newPassword: 'New-Password-456', confirmPassword: 'New-Password-456' };

  it('accept a valid password change', () => {
    assert.ok(passwordChangeSchema.safeParse(good).success);
  });

  it('refuse weak, mismatched and unchanged new passwords with French messages', () => {
    const message = (value: object) => {
      const result = passwordChangeSchema.safeParse({ ...good, ...value });
      return result.success ? null : result.error.issues[0].message;
    };
    assert.match(message({ newPassword: 'Court1a', confirmPassword: 'Court1a' }) ?? '', /12 caractères/);
    assert.match(message({ newPassword: 'nouveau-mot-de-passe-1', confirmPassword: 'nouveau-mot-de-passe-1' }) ?? '', /majuscule/);
    assert.match(message({ newPassword: 'NOUVEAU-MOT-DE-PASSE-1', confirmPassword: 'NOUVEAU-MOT-DE-PASSE-1' }) ?? '', /minuscule/);
    assert.match(message({ newPassword: 'Nouveau-mot-de-passe', confirmPassword: 'Nouveau-mot-de-passe' }) ?? '', /chiffre/);
    assert.match(message({ confirmPassword: 'Different-Password-1' }) ?? '', /confirmation/);
    assert.match(message({ newPassword: good.currentPassword, confirmPassword: good.currentPassword }) ?? '', /différent/);
    assert.equal(passwordChangeSchema.safeParse({ ...good, currentPassword: '' }).success, false);
  });

  it('refuse unknown fields (no mass assignment)', () => {
    assert.equal(passwordChangeSchema.safeParse({ ...good, email: 'x@example.com' }).success, false);
    assert.equal(accountNameSchema.safeParse({ name: 'Alex', email: 'x@example.com' }).success, false);
    assert.equal(accountNameSchema.safeParse({ name: 'Alex', passwordHash: 'x' }).success, false);
  });

  it('validate the name', () => {
    assert.equal(accountNameSchema.parse({ name: '  Alex Martin ' }).name, 'Alex Martin');
    assert.equal(accountNameSchema.safeParse({ name: 'A' }).success, false);
    assert.equal(accountNameSchema.safeParse({ name: ' ' }).success, false);
    assert.equal(accountNameSchema.safeParse({ name: 'x'.repeat(61) }).success, false);
  });

  it('deletion needs a password and the exact confirmation word', () => {
    assert.ok(accountDeleteSchema.safeParse({ password: 'pw', confirmation: 'SUPPRIMER' }).success);
    assert.equal(accountDeleteSchema.safeParse({ password: 'pw', confirmation: 'supprimer' }).success, false);
    assert.equal(accountDeleteSchema.safeParse({ password: '', confirmation: 'SUPPRIMER' }).success, false);
    assert.equal(accountDeleteSchema.safeParse({ password: 'pw' }).success, false);
  });

  it('export needs a password and nothing else', () => {
    assert.ok(accountExportSchema.safeParse({ password: 'pw' }).success);
    assert.equal(accountExportSchema.safeParse({ password: '' }).success, false);
    assert.equal(accountExportSchema.safeParse({ password: 'pw', userId: 'other' }).success, false);
  });

  it('session revocation accepts a session id or a scope, never both or anything else', () => {
    assert.ok(sessionRevokeSchema.safeParse({ scope: 'others' }).success);
    assert.ok(sessionRevokeSchema.safeParse({ scope: 'all' }).success);
    assert.ok(sessionRevokeSchema.safeParse({ sessionId: 'abc' }).success);
    assert.equal(sessionRevokeSchema.safeParse({ scope: 'everyone' }).success, false);
    assert.equal(sessionRevokeSchema.safeParse({ scope: 'all', sessionId: 'abc' }).success, false);
    assert.equal(sessionRevokeSchema.safeParse({ userId: 'other' }).success, false);
  });
});
