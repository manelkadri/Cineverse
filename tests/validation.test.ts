import assert from 'node:assert/strict';
import test from 'node:test';
import { loginSchema, mediaActionSchema, passwordSchema, profileInputSchema, progressInputSchema, registrationSchema } from '../src/lib/validation';

test('registration accepts a normalized valid account', () => {
  const result = registrationSchema.parse({ name: 'Maya', email: ' MAYA@EXAMPLE.COM ', password: 'CinemaSecure2026' });
  assert.equal(result.email, 'maya@example.com');
});

test('registration rejects weak passwords and malformed email addresses', () => {
  assert.equal(registrationSchema.safeParse({ name: 'Maya', email: 'bad', password: 'password' }).success, false);
  assert.equal(passwordSchema.safeParse('alllowercase123').success, false);
  assert.equal(loginSchema.safeParse({ email: 'viewer@example.com', password: '' }).success, false);
});

test('profile input validates a four-digit parental PIN', () => {
  const base = { name: 'Kids', avatar: 'mint', isKids: true, maturityLevel: 7, preferences: ['Animation'], language: 'fr-FR' };
  assert.equal(profileInputSchema.safeParse({ ...base, parentalPin: '1234' }).success, true);
  assert.equal(profileInputSchema.safeParse({ ...base, parentalPin: '12ab' }).success, false);
});

test('media actions keep movie and TV identifiers explicit', () => {
  assert.deepEqual(mediaActionSchema.parse({ mediaId: 'movie:157336' }), { mediaId: 'movie:157336' });
  assert.deepEqual(mediaActionSchema.parse({ mediaId: 'tv:66732' }), { mediaId: 'tv:66732' });
  assert.equal(mediaActionSchema.safeParse({ mediaId: '157336' }).success, false);
});

test('playback progress rejects impossible positions', () => {
  assert.equal(progressInputSchema.safeParse({ mediaId: 'movie:157336', positionSeconds: 120, durationSeconds: 100 }).success, false);
  assert.equal(progressInputSchema.safeParse({ mediaId: 'tv:66732', seasonNumber: 1, episodeNumber: 2, positionSeconds: 120, durationSeconds: 3000 }).success, true);
});
