import { describe, expect, test } from 'bun:test';
import { AFFECT_VAD, AffectState, DEFAULT_BASELINE, VAD_AXES, type Vad } from './affect';

// Drive the state with an explicit clock so every assertion is deterministic arithmetic, not feel.
function run(s: AffectState, seconds: number, from = 0, stepMs = 16): number {
  const end = from + seconds * 1000;
  let t = from;
  while (t < end) {
    t = Math.min(end, t + stepMs);
    s.tick(t);
  }
  return t;
}

// A fresh state whose clock has been started (the first tick only initialises `last`).
function started(opts?: ConstructorParameters<typeof AffectState>[0]): { s: AffectState; t: number } {
  const s = new AffectState(opts);
  s.tick(0);
  return { s, t: 0 };
}

describe('AffectState — rest', () => {
  test('at rest it stays exactly at the baseline, for a full minute', () => {
    const { s } = started();
    run(s, 60);
    for (const axis of VAD_AXES) {
      expect(s.current[axis]).toBeCloseTo(DEFAULT_BASELINE[axis], 10);
    }
  });

  test('a custom baseline is the resting point, not zero', () => {
    const baseline: Vad = { valence: -0.2, arousal: 0.3, dominance: 0.1 };
    const { s } = started({ baseline });
    run(s, 30);
    expect(s.current.valence).toBeCloseTo(-0.2, 10);
    expect(s.current.arousal).toBeCloseTo(0.3, 10);
  });
});

describe('AffectState — two timescales (the whole point)', () => {
  test('attack is fast: ~93% of the way to target within 2 s', () => {
    const { s, t } = started();
    const start = s.current.valence;
    s.nudge('bright_delight', 1);
    // target after the impulse: lerp(baseline, bright_delight, 0.86)
    const amount = 0.28 + 1 * 0.58;
    const target = start + (AFFECT_VAD.bright_delight.valence - start) * amount;

    run(s, 2, t);
    const travelled = (s.current.valence - start) / (target - start);
    // 1 - exp(-1.35 * 2) = 0.933 — asserted as arithmetic, with a little slack for the discrete steps.
    expect(travelled).toBeGreaterThan(0.9);
    expect(travelled).toBeLessThanOrEqual(1);
  });

  test('release is slow: 20 s later she is still visibly in the mood (>40% of the peak excursion)', () => {
    const { s, t } = started();
    const base = DEFAULT_BASELINE.valence;
    s.nudge('bright_delight', 1);
    const afterAttack = run(s, 3, t);
    const peak = s.current.valence - base;
    expect(peak).toBeGreaterThan(0.5); // she really did light up

    run(s, 20, afterAttack);
    const held = (s.current.valence - base) / peak;
    expect(held).toBeGreaterThan(0.4);
  });

  test('the mood does eventually fade — 5 minutes later she is near baseline again', () => {
    const { s, t } = started();
    s.nudge('bright_delight', 1);
    run(s, 300, t);
    expect(s.current.valence).toBeCloseTo(DEFAULT_BASELINE.valence, 1);
  });
});

describe('AffectState — hold', () => {
  test('during the hold window the target does not decay; after it expires, it does', () => {
    const { s, t } = started();
    s.nudge('annoyed_resistance', 1); // hold = 6 + 1*9 = 15 s
    const afterAttack = run(s, 4, t);
    const inHold = s.current.valence;

    // 4 s → 14 s: still inside the hold, so `current` has converged and should barely move.
    const atHoldEnd = run(s, 10, afterAttack);
    expect(s.current.valence).toBeCloseTo(inHold, 2);

    // Past the hold, decay pulls it back toward baseline.
    run(s, 60, atHoldEnd);
    expect(s.current.valence).toBeGreaterThan(inHold);
  });

  test('a weaker impulse holds for less time', () => {
    const strong = started();
    const weak = started();
    strong.s.nudge('annoyed_resistance', 1); // hold 15 s
    weak.s.nudge('annoyed_resistance', 0); // hold 6 s
    // Normalise for the different impulse size by comparing each against its own peak.
    const sPeak = (run(strong.s, 3, strong.t), strong.s.current.valence);
    const wPeak = (run(weak.s, 3, weak.t), weak.s.current.valence);
    run(strong.s, 25, 3000);
    run(weak.s, 25, 3000);
    const sRetained = (strong.s.current.valence - DEFAULT_BASELINE.valence) / (sPeak - DEFAULT_BASELINE.valence);
    const wRetained = (weak.s.current.valence - DEFAULT_BASELINE.valence) / (wPeak - DEFAULT_BASELINE.valence);
    expect(sRetained).toBeGreaterThan(wRetained);
  });
});

describe('AffectState — impulses', () => {
  test('intensity scales the impulse', () => {
    const soft = started();
    const hard = started();
    soft.s.nudge('bright_delight', 0.2);
    hard.s.nudge('bright_delight', 1);
    run(soft.s, 3, soft.t);
    run(hard.s, 3, hard.t);
    expect(hard.s.current.valence).toBeGreaterThan(soft.s.current.valence);
    expect(soft.s.current.valence).toBeGreaterThan(DEFAULT_BASELINE.valence); // still moved
  });

  test('reactivity 0 makes her affectively flat', () => {
    const { s, t } = started({ reactivity: 0 });
    s.nudge('annoyed_resistance', 1);
    run(s, 5, t);
    expect(s.current.valence).toBeCloseTo(DEFAULT_BASELINE.valence, 6);
  });

  test('HISTORY MATTERS — the same affect from two different prior states lands differently', () => {
    const warm = started();
    const cross = started();
    warm.s.nudge('soft_warmth', 1);
    cross.s.nudge('annoyed_resistance', 1);
    run(warm.s, 5, warm.t);
    run(cross.s, 5, cross.t);

    // Now give BOTH the identical affect.
    warm.s.nudge('curious_attention', 0.8);
    cross.s.nudge('curious_attention', 0.8);
    run(warm.s, 2, 5000);
    run(cross.s, 2, 5000);

    expect(Math.abs(warm.s.current.valence - cross.s.current.valence)).toBeGreaterThan(0.1);
  });

  test('repeated max-intensity nudges never leave −1..1', () => {
    const { s, t } = started();
    let now = t;
    for (let i = 0; i < 50; i++) {
      s.nudge('bright_delight', 1);
      now = run(s, 0.5, now);
    }
    for (const axis of VAD_AXES) {
      expect(s.current[axis]).toBeGreaterThanOrEqual(-1);
      expect(s.current[axis]).toBeLessThanOrEqual(1);
    }
  });
});

describe('AFFECT_VAD — the table that replaces the fan-in', () => {
  test('all 15 affects are present and pairwise distinct', () => {
    const entries = Object.entries(AFFECT_VAD);
    expect(entries.length).toBe(15);
    const seen = new Set(entries.map(([, v]) => `${v.valence},${v.arousal},${v.dominance}`));
    expect(seen.size).toBe(15);
  });

  test('the three affects that all collapse to the `tender` clip are genuinely separated', () => {
    const trio = ['gentle_concern', 'open_reengagement', 'soft_warmth'] as const;
    for (let i = 0; i < trio.length; i++) {
      for (let j = i + 1; j < trio.length; j++) {
        const a = AFFECT_VAD[trio[i]!];
        const b = AFFECT_VAD[trio[j]!];
        const maxAxisGap = Math.max(...VAD_AXES.map((k) => Math.abs(a[k] - b[k])));
        expect(maxAxisGap).toBeGreaterThan(0.2);
      }
    }
  });

  test('every axis of every affect is inside −1..1', () => {
    for (const v of Object.values(AFFECT_VAD)) {
      for (const axis of VAD_AXES) {
        expect(v[axis]).toBeGreaterThanOrEqual(-1);
        expect(v[axis]).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('AffectState — robustness', () => {
  test('deterministic: identical (tick, nudge) sequences produce identical state', () => {
    const a = started();
    const b = started();
    for (const s of [a, b]) {
      s.s.nudge('playful_brightness', 0.7);
      run(s.s, 2, 0);
      s.s.nudge('guarded_distance', 0.4);
      run(s.s, 3, 2000);
    }
    expect(a.s.current).toEqual(b.s.current);
  });

  test('a backgrounded tab does not teleport her: a 10-minute gap advances at most the dt clamp', () => {
    const gapped = started();
    const stepped = started();
    gapped.s.nudge('bright_delight', 1);
    stepped.s.nudge('bright_delight', 1);

    gapped.s.tick(600_000); // one enormous frame
    run(stepped.s, 0.25, 0); // the clamp's worth of real time

    expect(gapped.s.current.valence).toBeCloseTo(stepped.s.current.valence, 6);
  });

  test('clear() resets to baseline and restarts the clock', () => {
    const { s, t } = started();
    s.nudge('annoyed_resistance', 1);
    run(s, 3, t);
    expect(s.current.valence).toBeLessThan(0);

    s.clear();
    expect(s.current.valence).toBeCloseTo(DEFAULT_BASELINE.valence, 10);
    // The clock restarted, so the next tick must not apply a giant dt.
    s.tick(999_999);
    s.tick(1_000_015);
    expect(s.current.valence).toBeCloseTo(DEFAULT_BASELINE.valence, 6);
  });

  test('setBaseline moves where she comes to rest', () => {
    const { s, t } = started();
    s.setBaseline({ valence: 0.5 });
    run(s, 400, t);
    expect(s.current.valence).toBeCloseTo(0.5, 1);
  });
});
