import { describe, expect, test } from 'bun:test';
import { createGlide } from './glide';

describe('createGlide (v0.25.2)', () => {
  test('eases from delta to exactly 0 over the duration, then goes idle', () => {
    const g = createGlide(500);
    g.start(200, 1000);
    expect(g.step(1000)).toBeCloseTo(200); // ease(0)=0 → still at the old spot
    expect(g.step(1250)).toBeCloseTo(100); // ease(0.5)=0.5 → halfway
    expect(g.step(1500)).toBe(0); // the final step lands EXACTLY at 0
    expect(g.active()).toBe(false);
    expect(g.step(1600)).toBeNull(); // idle afterwards
  });

  test('a sub-pixel delta is a no-op (nothing to animate)', () => {
    const g = createGlide(500);
    g.start(0.3, 1000);
    expect(g.active()).toBe(false);
    expect(g.step(1000)).toBeNull();
  });

  test('retarget mid-flight: a second start() overwrites cleanly', () => {
    const g = createGlide(500);
    g.start(200, 1000);
    g.step(1250); // mid-flight
    g.start(-80, 1250); // e.g. the user expanded again mid-glide
    expect(g.step(1250)).toBeCloseTo(-80);
    expect(g.step(1750)).toBe(0);
    expect(g.active()).toBe(false);
  });

  test('stop() cancels an in-flight tween — no residual step (the reduce-motion snap path)', () => {
    const g = createGlide(500);
    g.start(200, 1000);
    expect(g.step(1100)).not.toBeNull(); // in flight
    g.stop();
    expect(g.active()).toBe(false);
    expect(g.step(1200)).toBeNull(); // no yank after a snap
  });

  test('easing is monotonic toward 0 (no overshoot)', () => {
    const g = createGlide(400);
    g.start(100, 0);
    let prev = Infinity;
    for (let t = 0; t <= 400; t += 40) {
      const v = g.step(t);
      if (v === null) break;
      expect(v).toBeLessThanOrEqual(prev + 1e-9);
      expect(v).toBeGreaterThanOrEqual(0);
      prev = v;
    }
  });
});
