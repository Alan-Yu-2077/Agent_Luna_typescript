import { describe, expect, test } from 'bun:test';
import { DEFAULT_BASELINE, type Vad } from './affect';
import { affectPose } from './affectPose';
import type { FaceStateKey } from './paramMap';

const ANGLE_KEYS: FaceStateKey[] = ['headPitch', 'headYaw', 'headRoll', 'bodyYaw', 'bodyLift', 'bodyRoll'];
const CEIL = 0.46;
const ANGLE_CEIL = CEIL * 8;

const vad = (valence: number, arousal: number, dominance: number): Vad => ({ valence, arousal, dominance });

describe('affectPose — silence at rest', () => {
  test('a dead-neutral state produces an EMPTY pose (the flag can never disturb a resting face)', () => {
    expect(affectPose(vad(0, 0, 0))).toEqual({});
  });

  test('the default baseline produces only sub-perceptual offsets', () => {
    const pose = affectPose(DEFAULT_BASELINE);
    for (const v of Object.values(pose)) {
      expect(Math.abs(v ?? 0)).toBeLessThan(0.05);
    }
  });
});

describe('affectPose — sign correctness', () => {
  test('positive valence smiles: mouthForm and eyeSmile rise', () => {
    const p = affectPose(vad(0.8, 0, 0));
    expect(p.mouthForm!).toBeGreaterThan(0);
    expect(p.eyeSmileL!).toBeGreaterThan(0);
    expect(p.eyeSmileR!).toBeCloseTo(p.eyeSmileL!, 10); // symmetric
  });

  test('negative valence pulls the mouth down and raises the inner brow', () => {
    const p = affectPose(vad(-0.8, 0, 0));
    expect(p.mouthForm!).toBeLessThan(0);
    expect(p.browLForm!).toBeGreaterThan(0);
  });

  test('arousal opens the eyes and lifts the brows; calm does the opposite to the eyes', () => {
    const hot = affectPose(vad(0, 0.9, 0));
    expect(hot.eyeOpenL!).toBeGreaterThan(0);
    expect(hot.browLY!).toBeGreaterThan(0);

    const cold = affectPose(vad(0, -0.9, 0));
    expect(cold.eyeOpenL!).toBeLessThan(0);
  });

  test('submission looks down and tilts; dominance lifts the chin', () => {
    const meek = affectPose(vad(0, 0, -0.9));
    expect(meek.gazeY!).toBeLessThan(0);
    expect(meek.headPitch!).toBeLessThan(0);
    expect(meek.headRoll!).toBeGreaterThan(0);

    const boss = affectPose(vad(0, 0, 0.9));
    expect(boss.headPitch!).toBeGreaterThan(0);
    expect(boss.gazeY!).toBeGreaterThan(0);
  });
});

describe('affectPose — interaction terms are genuinely multiplicative', () => {
  test('cheekPuff (blush) needs BOTH warmth and submission, not either alone', () => {
    expect(affectPose(vad(0.9, 0, 0)).cheekPuff ?? 0).toBe(0); // warm but not deferring
    expect(affectPose(vad(0, 0, -0.9)).cheekPuff ?? 0).toBe(0); // deferring but not warm
    expect(affectPose(vad(0.9, 0, -0.9)).cheekPuff!).toBeGreaterThan(0); // both
  });

  test('the angry-brow term needs displeasure AND standing', () => {
    expect(affectPose(vad(-0.9, 0, 0)).browLAngle ?? 0).toBe(0);
    expect(affectPose(vad(-0.9, 0, 0.9)).browLAngle!).toBeGreaterThan(0);
  });
});

describe('affectPose — it stays an undertone', () => {
  test('at all 8 corners of the VAD cube, no channel exceeds its ceiling', () => {
    for (const v of [-1, 1]) {
      for (const a of [-1, 1]) {
        for (const d of [-1, 1]) {
          const pose = affectPose(vad(v, a, d));
          for (const [key, value] of Object.entries(pose)) {
            const lim = ANGLE_KEYS.includes(key as FaceStateKey) ? ANGLE_CEIL : CEIL;
            expect(Math.abs(value ?? 0)).toBeLessThanOrEqual(lim + 1e-9);
          }
        }
      }
    }
  });

  test('angle channels are emitted in degrees, normalised channels are not', () => {
    // A full-submission lean should be a fraction of a degree * the scale — visible as posture,
    // but nowhere near the idle sway's ±40.
    const p = affectPose(vad(0, 0, -1));
    expect(Math.abs(p.headPitch!)).toBeGreaterThan(0.1); // scaled up from 0.035
    expect(Math.abs(p.headPitch!)).toBeLessThan(4);
    expect(Math.abs(p.gazeY!)).toBeLessThan(0.2); // normalised, untouched by the angle scale
  });
});

describe('affectPose — purity', () => {
  test('same input → identical output, and the input is not mutated', () => {
    const input = vad(0.3, -0.2, 0.6);
    const snapshot = { ...input };
    const a = affectPose(input);
    const b = affectPose(input);
    expect(a).toEqual(b);
    expect(input).toEqual(snapshot);
  });
});

// --- v0.42.2: the living baseline ---------------------------------------------------------------

import { restingState } from './affectPose';
import { FACE_STATE_KEYS, FACE_VM_DEFAULT_STATE, clampStateValue } from './paramMap';

describe('restingState — the pose she relaxes TO', () => {
  test('at a dead-neutral mood it is EXACTLY the old default (the zero-at-rest guarantee)', () => {
    expect(restingState(vad(0, 0, 0))).toEqual(FACE_VM_DEFAULT_STATE);
  });

  test('a mood shifts the resting pose by exactly REST_SHARE of the undertone', () => {
    const v = vad(0.8, 0, 0);
    const offset = affectPose(v).mouthForm!;
    const rest = restingState(v);
    expect(rest.mouthForm - FACE_VM_DEFAULT_STATE.mouthForm).toBeCloseTo(offset * 0.6, 9);
  });

  test('every channel stays inside its per-key clamp at all 8 VAD corners', () => {
    for (const a of [-1, 1]) {
      for (const b of [-1, 1]) {
        for (const c of [-1, 1]) {
          const rest = restingState(vad(a, b, c));
          for (const k of FACE_STATE_KEYS) {
            expect(rest[k]).toBe(clampStateValue(k, rest[k]));
          }
        }
      }
    }
  });

  test('a warm mood rests warmer than a sour one', () => {
    expect(restingState(vad(0.8, 0, 0)).mouthForm).toBeGreaterThan(restingState(vad(-0.8, 0, 0)).mouthForm);
  });
});
