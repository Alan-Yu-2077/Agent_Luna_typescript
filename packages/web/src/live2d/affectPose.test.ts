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

  test('arousal lifts the brows; being becalmed squints instead', () => {
    const hot = affectPose(vad(0, 0.9, 0));
    expect(hot.browLY!).toBeGreaterThan(0);

    // v0.43.0: arousal no longer touches the eyelids at all (see the eyelid invariant below).
    // What low arousal still does is narrow the eyes via the SQUINT channel, which is a separate
    // parameter from the blink one and therefore safe to drive.
    const cold = affectPose(vad(0, -0.9, 0));
    expect(cold.eyeSquintL!).toBeGreaterThan(0);
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

// --- v0.43.0: the eyelid invariant --------------------------------------------------------------

import { AFFECT_VAD } from './affect';

describe('the eyelid invariant — the mood never touches the blink parameter', () => {
  // The regression this locks down: v0.42.3 shipped an `eyeOpen` term, and because FaceVm writes
  // after the built-in CubismEyeBlink, it pinned ParamEyeOpenL at a constant 1.000 for 599 of every
  // 600 frames. She stopped blinking. Eyelids belong to the blink controller; nothing else may bid.
  const CORNERS: Vad[] = [];
  for (const v of [-1, 0, 1]) for (const a of [-1, 0, 1]) for (const d of [-1, 0, 1]) CORNERS.push(vad(v, a, d));

  test('no affect in the table produces an eyeOpen offset', () => {
    const offenders = Object.entries(AFFECT_VAD)
      .filter(([, v]) => 'eyeOpenL' in affectPose(v) || 'eyeOpenR' in affectPose(v))
      .map(([key]) => key);
    expect(offenders).toEqual([]);
  });

  test('nor does any of the 27 lattice points of the VAD cube', () => {
    for (const v of CORNERS) {
      const pose = affectPose(v);
      expect('eyeOpenL' in pose).toBe(false);
      expect('eyeOpenR' in pose).toBe(false);
    }
  });

  test('restingState leaves the eyelids at exactly the engine default everywhere', () => {
    for (const v of CORNERS) {
      const rest = restingState(v);
      expect(rest.eyeOpenL).toBe(FACE_VM_DEFAULT_STATE.eyeOpenL);
      expect(rest.eyeOpenR).toBe(FACE_VM_DEFAULT_STATE.eyeOpenR);
    }
  });

  test('the squint channel is still free to carry mood — it is not the blink parameter', () => {
    expect(affectPose(vad(0, -0.9, 0)).eyeSquintL!).toBeGreaterThan(0);
  });
});

describe('affectPose — perceptibility (v0.42.4)', () => {
  // The regression that would have caught the original miss: a full-intensity mood must move the
  // face by an amount a person can actually SEE, not merely an amount a test can measure.
  test('a strong warm mood moves the mouth by a visible fraction of full range', () => {
    const p = affectPose(vad(0.73, 0.47, 0.09)); // the real settled VAD after bright_delight @ 1.0
    expect(Math.abs(p.mouthForm!)).toBeGreaterThan(0.2);
    expect(Math.abs(p.eyeSmileL!)).toBeGreaterThan(0.1);
  });

  test('…and still stays under the ceiling, i.e. under a clip', () => {
    for (const v of [-1, 1]) {
      for (const a of [-1, 1]) {
        for (const d of [-1, 1]) {
          for (const [key, value] of Object.entries(affectPose(vad(v, a, d)))) {
            const lim = ANGLE_KEYS.includes(key as FaceStateKey) ? ANGLE_CEIL : CEIL;
            expect(Math.abs(value ?? 0)).toBeLessThanOrEqual(lim + 1e-9);
          }
        }
      }
    }
  });
});
