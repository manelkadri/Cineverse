import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CEILING, COMPLETE_MS, completingProgress, quantizeProgress, runningProgress } from '../src/lib/cinematic-progress';

const samples = (to: number, step = 16) => Array.from({ length: Math.floor(to / step) + 1 }, (_, i) => i * step);

describe('cinematic progress', () => {
  it('starts at exactly 0%', () => {
    assert.equal(runningProgress(0), 0);
    assert.equal(runningProgress(-50), 0);
    assert.equal(runningProgress(Number.NaN), 0);
  });

  it('never decreases while waiting, however long it takes', () => {
    let previous = -1;
    for (const t of samples(120000, 50)) {
      const p = runningProgress(t);
      assert.ok(p >= previous, `progress went backwards at ${t} ms`);
      previous = p;
    }
  });

  it('can never reach 100% (or even the ceiling) before the destination is ready', () => {
    for (const t of [1, 1000, 5000, 20000, 60000, 3_600_000, 1e12]) {
      const p = runningProgress(t);
      assert.ok(p < 1, `reached ${p} at ${t} ms`);
      assert.ok(p <= CEILING, `passed the ceiling at ${t} ms`);
    }
  });

  it('moves smoothly: small steps, no jumps', () => {
    let previous = runningProgress(0);
    for (const t of samples(10000)) {
      const p = runningProgress(t);
      assert.ok(p - previous < 0.02, `jumped ${(p - previous).toFixed(3)} at ${t} ms`);
      previous = p;
    }
  });

  it('travels from wherever it is to exactly 100% once ready, never going backwards', () => {
    for (const from of [0, 0.05, 0.3, 0.62, CEILING]) {
      let previous = from;
      for (const t of samples(COMPLETE_MS + 100, 8)) {
        const p = completingProgress(from, t);
        assert.ok(p >= previous - 1e-12, `went backwards from ${from} at ${t} ms`);
        assert.ok(p <= 1);
        previous = p;
      }
      assert.equal(completingProgress(from, COMPLETE_MS), 1);
      assert.equal(completingProgress(from, COMPLETE_MS * 10), 1);
    }
  });

  it('starts completing from the current position (no jump back to 0)', () => {
    assert.equal(completingProgress(0.41, 0), 0.41);
  });

  it('shows coarse, non-decreasing steps under reduced motion and reaches 1 only when complete', () => {
    let previous = 0;
    for (const t of samples(30000, 100)) {
      const q = quantizeProgress(runningProgress(t));
      assert.ok(q >= previous);
      assert.ok(q < 1);
      previous = q;
    }
    assert.equal(quantizeProgress(1), 1);
  });
});
