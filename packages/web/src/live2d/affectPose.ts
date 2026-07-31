import type { Vad } from './affect';
import type { Pose } from './faceData';
import type { FaceStateKey } from './paramMap';

// VAD → face undertone (Initiative 29, v0.42.1).
//
// This is the projection from the continuous mood field onto Luna's own channels. Adapted from
// soullink-emotion-sdk's VADExpressionMapper (MIT): rectified components (positive/negative,
// aroused/calm, dominant/submissive) plus a few interaction terms, all with small coefficients so the
// result reads as a *bias under everything else*, never as a performance.
//
// Two deliberate departures from that design, both forced by Luna's rig:
//
//  1. The output is an ADDITIVE OFFSET, not a pose to set. Her idle layer writes real motion into the
//     same channels (`headRoll: sway * 40`), so an assigning layer would flatten the sway. Callers add.
//  2. Channels are in NATIVE units. Her angle channels are degrees (~±30) while eyes/mouth/brows are
//     normalised (−1..1); one ceiling for both would be either invisible on the head or violent on the
//     mouth. So the normalised ceiling is the SDK's 0.46, and angle channels use the same ceiling
//     scaled by ANGLE_SCALE — a mood can lean her head about 3.7°, which reads as posture, not as a nod.
//
// Pure: same input → same output, input never mutated. Knows nothing about the default state, so
// v0.42.2 can reuse it to move the resting pose itself.

const CEIL = 0.46;
const ANGLE_SCALE = 8;

// Channels carried in degrees rather than normalised units.
const ANGLE_KEYS = new Set<FaceStateKey>(['headPitch', 'headYaw', 'headRoll', 'bodyYaw', 'bodyLift', 'bodyRoll']);

function ceilFor(key: FaceStateKey): number {
  return ANGLE_KEYS.has(key) ? CEIL * ANGLE_SCALE : CEIL;
}

function put(pose: Pose, key: FaceStateKey, value: number): void {
  if (value === 0) return;
  const scaled = ANGLE_KEYS.has(key) ? value * ANGLE_SCALE : value;
  const lim = ceilFor(key);
  const clamped = Math.max(-lim, Math.min(lim, scaled));
  // Sub-perceptual offsets are dropped so a resting state produces a provably EMPTY pose — that is
  // what makes enabling the layer a no-op on a neutral face.
  if (Math.abs(clamped) < 1e-6) return;
  pose[key] = clamped;
}

export function affectPose(vad: Vad): Pose {
  const positive = Math.max(0, vad.valence);
  const negative = Math.max(0, -vad.valence);
  const aroused = Math.max(0, vad.arousal);
  const calm = Math.max(0, -vad.arousal);
  const dominant = Math.max(0, vad.dominance);
  const submissive = Math.max(0, -vad.dominance);

  const pose: Pose = {};

  // Mouth — the strongest single carrier of valence.
  put(pose, 'mouthForm', positive * 0.13 + calm * positive * 0.05 - negative * 0.1 - calm * negative * 0.04);

  // Eyes: smiling comes from warmth, squint from displeasure-with-standing or from being becalmed,
  // aperture from arousal (bright and wide when lit up, heavy when low).
  const eyeSmile = positive * 0.08 + calm * positive * 0.035;
  put(pose, 'eyeSmileL', eyeSmile);
  put(pose, 'eyeSmileR', eyeSmile);
  const eyeSquint = negative * dominant * 0.08 + calm * 0.035;
  put(pose, 'eyeSquintL', eyeSquint);
  put(pose, 'eyeSquintR', eyeSquint);
  const eyeOpen = aroused * 0.08 - calm * 0.07 - negative * 0.035;
  put(pose, 'eyeOpenL', eyeOpen);
  put(pose, 'eyeOpenR', eyeOpen);

  // Brows carry most of the readable nuance: height from arousal, inner-raise from distress or
  // deference, angle from displeasure held with authority.
  const browY = aroused * 0.08 + positive * aroused * 0.035 - dominant * negative * 0.11;
  put(pose, 'browLY', browY);
  put(pose, 'browRY', browY);
  const browForm = negative * 0.08 + submissive * 0.055;
  put(pose, 'browLForm', browForm);
  put(pose, 'browRForm', browForm);
  const browAngle = dominant * negative * 0.09 - submissive * 0.04;
  put(pose, 'browLAngle', browAngle);
  put(pose, 'browRAngle', browAngle);

  // Posture — small, but it is what makes a mood legible from across the room.
  put(pose, 'headPitch', -submissive * 0.035 + dominant * 0.025 + aroused * 0.012);
  put(pose, 'headRoll', submissive * 0.02);
  put(pose, 'bodyLift', aroused * 0.03 - calm * 0.02);

  // Gaze: deference looks down, authority looks level-to-up.
  put(pose, 'gazeY', -submissive * 0.05 + dominant * 0.025);

  // The SDK's "blush" interaction — genuinely multiplicative: pleased AND deferring, not either alone.
  put(pose, 'cheekPuff', positive * submissive * 0.16);

  return pose;
}
