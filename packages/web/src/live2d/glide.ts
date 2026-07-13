import { clamp01, easeInOutSine, lerp } from './ease';

// v0.25.2 (Initiative 18): the model's center ↔ right glide — a pure, clock-injected tween of a
// horizontal MODE offset easing to 0. Used FLIP-style by pixiLive2DSink.glideLayout: after a layout
// change snaps `fit()` to the new center, the mode offset is set to (old visual x − new visual x) so
// the model APPEARS unmoved, then eases to 0 — i.e. she glides to her new home. Deliberately not a
// generic tween: one axis, one target (0), retargetable mid-flight (start() just overwrites).

export type Glide = {
  // Begin easing from `deltaX` to 0. A sub-pixel delta is a no-op (nothing to animate).
  start(deltaX: number, nowMs: number): void;
  // The offset for this frame, or null when idle. The final step returns exactly 0, then idle.
  step(nowMs: number): number | null;
  // Cancel an in-flight tween (snap to rest) — the next step() is null, no residual motion.
  stop(): void;
  active(): boolean;
};

export function createGlide(durationMs = 520): Glide {
  let from = 0;
  let t0 = 0;
  let running = false;
  return {
    start(deltaX, nowMs) {
      if (Math.abs(deltaX) < 0.5) {
        running = false;
        return;
      }
      from = deltaX;
      t0 = nowMs;
      running = true;
    },
    step(nowMs) {
      if (!running) return null;
      const p = clamp01((nowMs - t0) / durationMs);
      if (p >= 1) running = false;
      return lerp(from, 0, easeInOutSine(p));
    },
    stop() {
      running = false;
    },
    active: () => running,
  };
}
