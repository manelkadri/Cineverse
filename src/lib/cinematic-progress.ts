// Visual progress for the cinematic profile transition.
//
// This is a *visual transition indicator*, not a measured download percentage: the App Router gives no
// reliable byte count for a server render, images and API calls together, so nothing here pretends otherwise.
// While the destination is being prepared the bar eases toward (but can never reach) CEILING. Only when the
// app reports that the destination is ready does it travel the remaining distance to exactly 1.
//
// Every function is monotonic: progress never decreases, never restarts, never exceeds 1.

/** The bar can never pass this while the destination is not ready. */
export const CEILING = 0.9;
/** Time constant (ms) of the easing toward CEILING: about 63% of the way there after this long. */
export const TAU_MS = 2400;
/** Time (ms) to travel from the current position to 100% once the destination is ready. */
export const COMPLETE_MS = 260;
/** Time (ms) the finished bar stays visible before the screen fades out. */
export const HOLD_MS = 220;
/** Time (ms) of the fade-out. */
export const FADE_MS = 320;
/** If the destination is still not ready after this long, show the recovery options instead of waiting forever. */
export const STALL_MS = 20000;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Progress while waiting: 0 at the start, then easing toward CEILING without ever reaching it. */
export function runningProgress(elapsedMs: number) {
  if (!(elapsedMs > 0)) return 0;
  return CEILING * (1 - Math.exp(-elapsedMs / TAU_MS));
}

/** Progress once ready: from `from` to exactly 1 (ease-out), `elapsedMs` after the destination became ready. */
export function completingProgress(from: number, elapsedMs: number) {
  const start = clamp01(from);
  const t = clamp01(elapsedMs / COMPLETE_MS);
  if (t >= 1) return 1;
  const eased = 1 - Math.pow(1 - t, 3);
  return start + (1 - start) * eased;
}

/** Reduced motion: the same progress shown in coarse steps, so nothing glides. */
export function quantizeProgress(value: number, steps = 6) {
  const v = clamp01(value);
  return v >= 1 ? 1 : Math.floor(v * steps) / steps;
}
