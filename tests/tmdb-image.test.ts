import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isTmdbImageUrl, tmdbImageLoader, tmdbSizeFor, toTmdbMarker } from '../src/lib/tmdb-image';

const POSTER = 'https://image.tmdb.org/t/p/w500/abc123.jpg';
const BACKDROP = 'https://image.tmdb.org/t/p/original/back456.jpg';
const PROFILE = 'https://image.tmdb.org/t/p/w185/face789.jpg';

describe('TMDB image loader', () => {
  it('recognises TMDB CDN URLs only', () => {
    assert.equal(isTmdbImageUrl(POSTER), true);
    assert.equal(isTmdbImageUrl('/assets/images/no_image.png'), false);
    assert.equal(isTmdbImageUrl('https://images.unsplash.com/photo.jpg'), false);
    assert.equal(isTmdbImageUrl('https://image.tmdb.org.evil.example/t/p/w500/x.jpg'), false);
  });

  it('picks the smallest poster size that covers the requested width', () => {
    assert.equal(tmdbSizeFor('poster', 90), 'w92');
    assert.equal(tmdbSizeFor('poster', 256), 'w342');
    assert.equal(tmdbSizeFor('poster', 384), 'w342'); // 342px is within 15% of 384px
    assert.equal(tmdbSizeFor('poster', 448), 'w500');
    assert.equal(tmdbSizeFor('poster', 640), 'w780');
    assert.equal(tmdbSizeFor('poster', 3840), 'w780');
  });

  it('serves smaller backdrops to small screens and original only above 1280px', () => {
    assert.equal(tmdbSizeFor('backdrop', 640), 'w780');
    assert.equal(tmdbSizeFor('backdrop', 1080), 'w1280');
    assert.equal(tmdbSizeFor('backdrop', 1280), 'w1280');
    assert.equal(tmdbSizeFor('backdrop', 1440), 'w1280'); // laptop screens do not need the multi-megabyte original
    assert.equal(tmdbSizeFor('backdrop', 1920), 'original');
    assert.equal(tmdbSizeFor('backdrop', 3840), 'original');
  });

  it('only uses sizes TMDB publishes', () => {
    const published = {
      poster: ['w92', 'w154', 'w185', 'w342', 'w500', 'w780', 'original'],
      backdrop: ['w300', 'w780', 'w1280', 'original'],
      profile: ['w45', 'w185', 'h632', 'original'],
    } as const;
    for (const kind of ['poster', 'backdrop', 'profile'] as const) {
      for (const width of [16, 32, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840]) {
        assert.ok((published[kind] as readonly string[]).includes(tmdbSizeFor(kind, width)), `${kind} @ ${width}`);
      }
    }
  });

  it('builds direct CDN URLs from stored URLs and from the marker form', () => {
    assert.equal(tmdbImageLoader(POSTER, 256), 'https://image.tmdb.org/t/p/w342/abc123.jpg');
    assert.equal(tmdbImageLoader(toTmdbMarker(POSTER), 256), 'https://image.tmdb.org/t/p/w342/abc123.jpg');
    assert.equal(tmdbImageLoader(toTmdbMarker(BACKDROP), 640), 'https://image.tmdb.org/t/p/w780/back456.jpg');
    assert.equal(tmdbImageLoader(toTmdbMarker(BACKDROP), 1920), 'https://image.tmdb.org/t/p/original/back456.jpg');
    assert.equal(tmdbImageLoader(toTmdbMarker(PROFILE), 128), 'https://image.tmdb.org/t/p/w185/face789.jpg');
  });

  it('never returns the marker unchanged (avoids next/image loader warnings)', () => {
    for (const url of [POSTER, BACKDROP, PROFILE]) {
      for (const width of [32, 384, 640, 1920]) assert.notEqual(tmdbImageLoader(toTmdbMarker(url), width), toTmdbMarker(url));
    }
  });

  it('adds a cache-busting parameter only for retries', () => {
    assert.equal(tmdbImageLoader(POSTER, 384, 0).includes('?'), false);
    assert.equal(tmdbImageLoader(POSTER, 384, 2), 'https://image.tmdb.org/t/p/w342/abc123.jpg?retry=2');
  });

  it('leaves non-TMDB sources untouched', () => {
    assert.equal(toTmdbMarker('/assets/images/no_image.png'), '/assets/images/no_image.png');
    assert.equal(tmdbImageLoader('/assets/images/no_image.png', 640), '/assets/images/no_image.png');
  });
});
