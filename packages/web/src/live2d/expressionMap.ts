import { ExpressionKey } from '@luna/protocol';
import { FACE_VM_DEFAULT_STATE, type FaceStateKey } from './paramMap';

// First-cut mapping of the 15 protocol affects → yumi facial poses (raw Cubism
// values on the FaceVM state keys). v0.13.2 replaces this with the full
// emotion-library timelines + special-effect params (hearts/stars/etc.).

export type Pose = Partial<Record<FaceStateKey, number>>;

const POSES: Record<ExpressionKey, Pose> = {
  curious_attention: { headYaw: 8, gazeX: 0.4, browLY: 0.3, browRY: 0.3, eyeOpenL: 1.1, eyeOpenR: 1.1, mouthForm: 0.2 },
  gentle_concern: { headPitch: -5, browLForm: -0.5, browRForm: -0.5, browLY: -0.2, browRY: -0.2, eyeSmileL: 0.1, eyeSmileR: 0.1 },
  open_reengagement: { headPitch: 4, eyeSmileL: 0.4, eyeSmileR: 0.4, mouthForm: 0.4 },
  playful_brightness: { headRoll: 6, eyeSmileL: 0.6, eyeSmileR: 0.6, mouthForm: 0.6, mouthOpen: 0.2 },
  focused_engagement: { headPitch: -3, browLY: -0.4, browRY: -0.4, gazeY: -0.1, mouthForm: 0.05 },
  steady_presence: { eyeSmileL: 0.2, eyeSmileR: 0.2, mouthForm: 0.15 },
  soft_warmth: { headRoll: 4, eyeSmileL: 0.7, eyeSmileR: 0.7, mouthForm: 0.5 },
  listening_attention: { headYaw: 6, gazeX: 0.3, eyeOpenL: 1.05, eyeOpenR: 1.05, browLY: 0.15, browRY: 0.15 },
  alert_surprise: { eyeOpenL: 1.3, eyeOpenR: 1.3, browLY: 0.6, browRY: 0.6, mouthOpen: 0.4, headPitch: 3 },
  bright_delight: { eyeSmileL: 0.9, eyeSmileR: 0.9, mouthForm: 0.9, mouthOpen: 0.4, headPitch: 5 },
  amused_smirk: { mouthShift: 0.4, mouthForm: 0.5, eyeSmileL: 0.5, eyeSmileR: 0.2, browRForm: 0.3 },
  shy_softness: { headPitch: -6, headYaw: -8, gazeY: -0.5, eyeSmileL: 0.4, eyeSmileR: 0.4, mouthForm: 0.2 },
  awkward_lightness: { gazeX: 0.5, headYaw: -5, browLForm: 0.3, browRForm: 0.3, mouthShift: 0.3 },
  guarded_distance: { headPitch: 3, browLY: -0.3, browRY: -0.3, eyeOpenL: 0.85, eyeOpenR: 0.85, mouthForm: -0.2 },
  annoyed_resistance: { browLY: -0.6, browRY: -0.6, browLAngle: 0.4, browRAngle: 0.4, mouthForm: -0.4, mouthShrug: 0.3 },
};

// Blend the pose against neutral by `emotion` (0..1): target = default + (pose - default) * emotion.
export function expressionParams(key: ExpressionKey, emotion = 0.6): Pose {
  const base = POSES[key];
  if (!base) return {};
  const scale = Math.max(0, Math.min(1, emotion));
  const out: Pose = {};
  for (const k of Object.keys(base) as FaceStateKey[]) {
    const def = FACE_VM_DEFAULT_STATE[k];
    out[k] = def + ((base[k] ?? def) - def) * scale;
  }
  return out;
}

export function hasPose(key: ExpressionKey): boolean {
  return Object.keys(POSES[key]).length > 0;
}
