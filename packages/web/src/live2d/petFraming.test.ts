import { describe, expect, test } from 'bun:test';
import { petFraming } from './petFraming';

// A reference-model-ish natural size (taller than wide, full body).
const W = 900;
const H = 2000;

describe('petFraming', () => {
  test('scales UP past the full-body height-fit (a tighter, half-body crop)', () => {
    const fullBodyScale = (812 * 0.92) / H; // host 375x812 (mobile-ish pet window)
    const f = petFraming(375, 812, W, H);
    expect(f.scale).toBeGreaterThan(fullBodyScale);
  });

  test('top-anchored: head near the top, not vertically centered', () => {
    const f = petFraming(560, 900, W, H);
    // baseY is a small positive fraction of host height (headroom), NOT (hostH - scaledH)/2 which
    // would be large-negative for a body taller than the window.
    expect(f.baseY).toBeGreaterThanOrEqual(0);
    expect(f.baseY).toBeLessThan(900 * 0.2);
  });

  test('horizontally centered (baseX centers the scaled width in the host)', () => {
    const f = petFraming(560, 900, W, H);
    const scaledW = W * f.scale;
    expect(f.baseX).toBeCloseTo((560 - scaledW) / 2, 3);
  });

  test('re-fits to any window size — larger window → larger scale (derives from live dims)', () => {
    const small = petFraming(400, 640, W, H);
    const large = petFraming(800, 1280, W, H);
    expect(large.scale).toBeGreaterThan(small.scale);
  });

  test('degenerate inputs (0 dims) return a safe fallback, never NaN/Infinity (v0.28.3 review)', () => {
    for (const f of [petFraming(375, 812, 0, 0), petFraming(375, 812, 900, 0), petFraming(0, 0, 900, 2000)]) {
      expect(Number.isFinite(f.scale)).toBe(true);
      expect(Number.isFinite(f.baseX)).toBe(true);
      expect(Number.isFinite(f.baseY)).toBe(true);
    }
  });
});
