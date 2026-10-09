import assert from 'node:assert/strict';
import test from 'node:test';
import { isContentAllowed, restrictItemsForProfile } from '../src/lib/content-policy';
import { makeMediaId, parseMediaId } from '../src/lib/media-id';
import { playbackCompleted, playbackProgressKey } from '../src/lib/viewing';
import type { ContentItem } from '../src/lib/profile-types';

const item = (id: number, maturityLevel: number): ContentItem => ({
  id: makeMediaId('movie', id), tmdbId: id, title: `Film ${id}`, posterPath: '', backdropPath: '', year: 2026,
  rating: 8, mediaType: 'movie', genres: [], maturityLevel, durationSeconds: 6000,
});

test('compound identifiers never confuse movie and TV IDs', () => {
  assert.deepEqual(parseMediaId('movie:42'), { mediaType: 'movie', tmdbId: 42 });
  assert.deepEqual(parseMediaId('tv:42'), { mediaType: 'tv', tmdbId: 42 });
  assert.notEqual(makeMediaId('movie', 42), makeMediaId('tv', 42));
});

test('kids policy conservatively removes content above the active limit', () => {
  const access = { isKids: true, maturityLevel: 7 };
  assert.equal(isContentAllowed(7, access), true);
  assert.equal(isContentAllowed(13, access), false);
  assert.deepEqual(restrictItemsForProfile([item(1, 7), item(2, 13), item(3, 18)], access).map((media) => media.tmdbId), [1]);
});

test('adult profiles are not restricted by the kids policy', () => {
  assert.equal(restrictItemsForProfile([item(1, 7), item(2, 18)], { isKids: false, maturityLevel: 18 }).length, 2);
});

test('playback helpers separate episodes and mark completion at 95 percent', () => {
  assert.equal(playbackProgressKey('tv:66732', 1, 2), 'tv:66732:s1:e2');
  assert.notEqual(playbackProgressKey('tv:66732', 1, 2), playbackProgressKey('tv:66732', 1, 3));
  assert.equal(playbackCompleted(949, 1000), false);
  assert.equal(playbackCompleted(950, 1000), true);
});
