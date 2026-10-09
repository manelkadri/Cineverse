import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SUPPORT_CATEGORIES, SUPPORT_LIMITS, SUPPORT_STATUSES, cleanText, containsSensitiveContent, countLinks } from '../src/lib/support-rules';
import { supportRequestSchema, supportTicketPatchSchema } from '../src/lib/validation';

const good = { subject: 'Impossible de me connecter', category: 'login', email: 'Alex@Example.com ', message: 'Depuis hier, la page de connexion affiche une erreur quand je valide.' };

describe('support request validation', () => {
  it('accepts a good request and normalises it', () => {
    const parsed = supportRequestSchema.parse({ ...good, subject: '  Impossible de me connecter  ', message: `${good.message}\r\nMerci` });
    assert.equal(parsed.email, 'alex@example.com');
    assert.equal(parsed.subject, 'Impossible de me connecter');
    assert.ok(!parsed.message.includes('\r'));
  });

  it('knows the categories and statuses the form and the admin area use', () => {
    assert.deepEqual(SUPPORT_CATEGORIES.map((item) => item.id), ['login', 'profiles', 'catalog', 'list', 'privacy', 'technical', 'other']);
    assert.deepEqual(SUPPORT_STATUSES.map((item) => item.id), ['open', 'in_progress', 'resolved', 'closed']);
  });

  it('refuses missing, too short and too long fields, with French messages', () => {
    const problem = (change: object) => {
      const result = supportRequestSchema.safeParse({ ...good, ...change });
      return result.success ? null : result.error.issues[0].message;
    };
    assert.match(problem({ subject: 'ab' }) ?? '', /sujet/i);
    assert.match(problem({ subject: 'x'.repeat(SUPPORT_LIMITS.subjectMax + 1) }) ?? '', /sujet/i);
    // categories are managed by the support team: the schema checks the format, the route checks the live list (support.integration.test.ts)
    assert.match(problem({ category: 'Bad Category!' }) ?? '', /catégorie/i);
    assert.equal(problem({ category: 'billing' }), null);
    assert.match(problem({ email: 'not-an-email' }) ?? '', /e-mail/i);
    assert.match(problem({ email: '' }) ?? '', /e-mail/i);
    assert.match(problem({ message: 'trop court' }) ?? '', /message/i);
    assert.match(problem({ message: 'x'.repeat(SUPPORT_LIMITS.messageMax + 1) }) ?? '', /message/i);
    assert.equal(problem({}), null);
  });

  it('refuses unknown fields, so an account id or an admin flag can never be supplied', () => {
    for (const extra of [{ userId: 'someone' }, { status: 'closed' }, { isSupportAdmin: true }, { adminNote: 'x' }]) {
      assert.equal(supportRequestSchema.safeParse({ ...good, ...extra }).success, false, JSON.stringify(extra));
    }
  });

  it('only lets staff change the status and the note of a ticket', () => {
    assert.ok(supportTicketPatchSchema.safeParse({ status: 'resolved' }).success);
    assert.ok(supportTicketPatchSchema.safeParse({ adminNote: 'Rappelé le 12.' }).success);
    assert.equal(supportTicketPatchSchema.safeParse({}).success, false);
    assert.equal(supportTicketPatchSchema.safeParse({ status: 'deleted' }).success, false);
    assert.equal(supportTicketPatchSchema.safeParse({ message: 'edited' }).success, false, 'the author’s text is never edited');
    assert.equal(supportTicketPatchSchema.safeParse({ adminNote: 'x'.repeat(SUPPORT_LIMITS.noteMax + 1) }).success, false);
  });
});

describe('support message safety', () => {
  it('refuses messages that contain a password, a PIN or a token', () => {
    const secrets = [
      'Mon mot de passe : Azerty-2024!x',
      'password=hunter2hunter2',
      'mon mot de passe est Soleil2024!',
      'le code PIN est 7392',
      'pin: 5038',
      'Mon PIN 4821 ne marche plus',
      'cookie: __Secure-next-auth.session-token=abcdef',
      'next-auth.csrf-token=abc123',
      'Authorization: Bearer abcdefghijklmnopqrstuvwxyz0123456789',
      'token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijk',
      'hash $2b$12$abcdefghijklmnopqrstuv',
      'AUTH_SECRET=quelquechose',
      'postgresql://postgres:secretpass@db.example.com:5432/postgres',
    ];
    for (const text of secrets) assert.equal(containsSensitiveContent(text), true, text);
  });

  it('accepts ordinary sentences about passwords and PINs (no false alarm)', () => {
    const fine = [
      'J’ai oublié mon mot de passe et je ne peux plus me connecter.',
      'Mon mot de passe est refusé alors que je le connais.',
      'Mon code PIN ne fonctionne plus depuis ce matin.',
      'Le message « Code PIN incorrect » s’affiche à chaque fois.',
      'Je veux changer le code PIN à 4 chiffres de mon profil enfant.',
      'Après 5 erreurs de PIN, le profil est bloqué ; combien de temps ?',
      'L’écran de chargement reste bloqué à 90 % sur mon téléphone.',
    ];
    for (const text of fine) assert.equal(containsSensitiveContent(text), false, text);
  });

  it('cleans control characters and counts links', () => {
    assert.equal(cleanText('  a\u0000b\u0007c \r\n d  '), 'abc \n d');
    assert.equal(countLinks('voir https://a.example et http://b.example et www.c.example'), 3);
    assert.equal(countLinks('aucun lien ici'), 0);
  });
});

describe('support admin lookup', () => {
  it('tells a confirmed admin, a refusal and a failed check apart', async () => {
    const { adminStatus } = await import('../src/lib/support-rules');
    assert.equal(await adminStatus(async () => ({ isSupportAdmin: true })), 'admin');
    assert.equal(await adminStatus(async () => ({ isSupportAdmin: false })), 'not-admin');
    assert.equal(await adminStatus(async () => null), 'not-admin', 'an unknown account is simply not an admin');
  });

  it('never grants access when the check itself fails (out-of-date column or Prisma client, database error)', async () => {
    const { adminStatus } = await import('../src/lib/support-rules');
    const outOfDateClient = async () => { throw new Error('Unknown field `isSupportAdmin` for select statement on model `User`'); };
    assert.equal(await adminStatus(outOfDateClient), 'unavailable');
    assert.equal(await adminStatus(async () => { throw new Error('connection refused'); }), 'unavailable');
    assert.notEqual(await adminStatus(outOfDateClient), 'admin');
    // a truthy-but-not-true value is not an admin either
    assert.equal(await adminStatus(async () => ({ isSupportAdmin: 'true' as unknown as boolean })), 'not-admin');
  });
});
