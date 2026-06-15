import type { FaceStateKey } from './paramMap';

// Ported data for the high-fidelity FaceVM (v0.13.2), from Python
// js/runtime/layers/emotion-library.js + action-library.js + config.js. The
// per-emotion sine micro-motion (getEmotionStateWithMotion) is deferred polish;
// the entry→sustained poses + timeline + actions + overlays carry the identity.

export type Pose = Partial<Record<FaceStateKey, number>>;
export type FaceChannel = 'brows' | 'eyes' | 'mouth' | 'gaze' | 'pose' | 'specials';

export type EmotionDef = {
  timeline: { introMs: number; performMs: number; outroMs: number };
  owns: FaceChannel[];
  entryState: Pose;
  sustainedState: Pose;
  actionRefs: string[];
  overlayRefs: string[];
  physicsPassthrough: FaceStateKey[];
};

export type Keyframe = { at: number; value: number };
export type ActionDef = { durationMs: number; tracks: Partial<Record<FaceStateKey, Keyframe[]>> };

export const FACE_CHANNEL_GROUPS: Record<FaceChannel, FaceStateKey[]> = {
  pose: ['headPitch', 'headYaw', 'headRoll', 'bodyYaw', 'bodyLift', 'bodyRoll', 'bow', 'bowPress'],
  gaze: ['gazeX', 'gazeY'],
  eyes: ['eyeOpenL', 'eyeOpenR', 'eyeSquintL', 'eyeSquintR', 'eyeSize', 'eyeSmileL', 'eyeSmileR'],
  mouth: ['mouthOpen', 'mouthForm', 'mouthShift', 'mouthPucker', 'mouthShrug', 'jawOpen', 'tongueOut'],
  brows: ['browLY', 'browRY', 'browLX', 'browRX', 'browLAngle', 'browRAngle', 'browLForm', 'browRForm'],
  specials: ['cheekPuff'],
};

// face-vm.js:44-57 — keys that emotion soft-blends (lerp) instead of hard-replacing.
export const EMOTION_SOFT_BLEND_WEIGHTS: Partial<Record<FaceStateKey, number>> = {
  headPitch: 0.82, headYaw: 0.78, headRoll: 0.78,
  bodyYaw: 0.74, bodyLift: 0.76, bodyRoll: 0.72,
  bow: 0.84, bowPress: 0.9,
  gazeX: 0.7, gazeY: 0.7,
  eyeOpenL: 0.66, eyeOpenR: 0.66,
};

// face-vm.js:4-15 — display gains applied before clamping at flush.
export const FACE_PARAM_GAIN: Partial<Record<FaceStateKey, number>> = {
  eyeSmileL: 1.8, eyeSmileR: 1.8,
  mouthForm: 1.6, mouthShift: 1.8,
  browLX: 1.35, browRX: 1.35,
  browLAngle: 1.8, browRAngle: 1.8,
  browLY: 1.35, browRY: 1.35,
};

// overlayRefs → special yumi params (config.js EXPRESSION_MAP).
export const OVERLAYS: Record<string, Record<string, number>> = {
  脸红: { Paramsmileshy: 1 },
  俯身: { Paramdown1: 1 },
  黑脸: { Paramheilian: 1 },
  泪汪汪: { Paramleiwangwang: 1 },
};
export const ALL_OVERLAY_PARAMS = ['Paramsmileshy', 'Paramdown1', 'Paramheilian', 'Paramleiwangwang'];

export const EMOTIONS = {
  focused: {
    timeline: { introMs: 820, performMs: 5600, outroMs: 1100 },
    owns: ['brows', 'eyes', 'mouth', 'gaze', 'pose'],
    entryState: { browLY: -0.28, browRY: -0.28, browLAngle: -0.32, browRAngle: -0.32, browLForm: -0.22, browRForm: -0.22, eyeOpenL: 0.74, eyeOpenR: 0.74, eyeSquintL: 0.1, eyeSquintR: 0.1, gazeY: -0.08, gazeX: 0.06, headPitch: 1.4, headYaw: 0.8, bodyYaw: 0.8, mouthForm: 0.06, mouthShift: 0.01, mouthOpen: 0.025, mouthPucker: -0.52, mouthShrug: 1.1 },
    sustainedState: { browLY: -0.46, browRY: -0.46, browLAngle: -0.52, browRAngle: -0.52, browLForm: -0.34, browRForm: -0.34, eyeOpenL: 0.68, eyeOpenR: 0.68, eyeSquintL: 0.14, eyeSquintR: 0.14, gazeY: -0.12, gazeX: 0.1, headPitch: 2.4, headYaw: 1.8, bodyYaw: 1.2, mouthForm: 0.08, mouthShift: 0.015, mouthOpen: 0.035, mouthPucker: -0.82, mouthShrug: 1.5 },
    actionRefs: [], overlayRefs: [], physicsPassthrough: [],
  },
  fakeFierce: {
    timeline: { introMs: 900, performMs: 5200, outroMs: 1100 },
    owns: ['brows', 'eyes', 'mouth', 'specials', 'gaze', 'pose'],
    entryState: { browLY: -0.56, browRY: -0.56, browLX: -0.12, browRX: 0.12, browLAngle: -0.62, browRAngle: -0.62, browLForm: -0.52, browRForm: -0.52, eyeOpenL: 0.76, eyeOpenR: 0.76, eyeSquintL: 0.12, eyeSquintR: 0.12, gazeX: 0.08, gazeY: -0.08, headPitch: 1.2, headYaw: 1.2, bodyYaw: 0.8, bodyRoll: -0.5, mouthForm: 0.08, mouthShift: 0.24, mouthPucker: -0.18, cheekPuff: 0.34 },
    sustainedState: { browLY: -0.92, browRY: -0.92, browLX: -0.18, browRX: 0.18, browLAngle: -0.96, browRAngle: -0.96, browLForm: -0.92, browRForm: -0.92, eyeOpenL: 0.72, eyeOpenR: 0.72, eyeSquintL: 0.08, eyeSquintR: 0.08, gazeX: 0.12, gazeY: -0.12, headPitch: 2.4, headYaw: 2.4, bodyYaw: 1.4, bodyRoll: -0.8, mouthForm: 0.12, mouthShift: 0.48, mouthPucker: -0.28, cheekPuff: 0.68 },
    actionRefs: [], overlayRefs: [], physicsPassthrough: [],
  },
  adorable: {
    timeline: { introMs: 780, performMs: 6200, outroMs: 1100 },
    owns: ['brows', 'eyes', 'mouth', 'gaze', 'pose', 'specials'],
    entryState: { headPitch: -1.8, headYaw: -2.4, headRoll: -8.5, bow: 1, bowPress: 1, bodyYaw: -1.8, bodyRoll: -2.8, bodyLift: 0.8, gazeX: 0.04, gazeY: 0.08, eyeOpenL: 1, eyeOpenR: 1, browLY: -0.96, browRY: -0.96, browLX: -0.28, browRX: 0.28, browLAngle: 1, browRAngle: 1, browLForm: -0.72, browRForm: -0.72, mouthOpen: 0, mouthForm: 0, mouthShift: 0, mouthPucker: -0.5, mouthShrug: 1.5, cheekPuff: 1 },
    sustainedState: { headPitch: -3.2, headYaw: -3.4, headRoll: -12.5, bow: 1, bowPress: 1, bodyYaw: -2.8, bodyRoll: -4.2, bodyLift: 1.2, gazeX: 0.08, gazeY: 0.12, eyeOpenL: 1, eyeOpenR: 1, browLY: -1, browRY: -1, browLX: -0.28, browRX: 0.28, browLAngle: 1, browRAngle: 1, browLForm: -0.72, browRForm: -0.72, mouthOpen: 0, mouthForm: 0, mouthShift: 0, mouthPucker: -0.5, mouthShrug: 1.5, cheekPuff: 1 },
    actionRefs: [], overlayRefs: ['脸红', '俯身'], physicsPassthrough: ['eyeOpenL', 'eyeOpenR', 'eyeSquintL', 'eyeSquintR', 'eyeSize'],
  },
  playful: {
    timeline: { introMs: 760, performMs: 6200, outroMs: 1000 },
    owns: ['brows', 'eyes', 'mouth', 'pose', 'gaze', 'specials'],
    entryState: { headPitch: 1, headRoll: -5.8, headYaw: 3.2, bodyRoll: -1.8, bodyYaw: 1.4, gazeX: 0.08, gazeY: 0.02, eyeOpenL: 0.7, eyeOpenR: 0.88, eyeSquintL: 0.1, eyeSquintR: 0.04, browLY: 0.04, browRY: 0.12, browLAngle: -0.04, browRAngle: -0.08, browLForm: 0.04, browRForm: 0.1, mouthForm: 0.22, mouthShift: 0.12, mouthOpen: 0.04, mouthPucker: -0.08, mouthShrug: 0.18, tongueOut: 0.04 },
    sustainedState: { headPitch: 1.8, headRoll: -8.4, headYaw: 4.8, bodyRoll: -2.8, bodyYaw: 2, gazeX: 0.16, gazeY: 0, eyeOpenL: 0.62, eyeOpenR: 0.94, eyeSquintL: 0.14, eyeSquintR: 0.05, browLY: 0.08, browRY: 0.18, browLAngle: -0.08, browRAngle: -0.14, browLForm: 0.1, browRForm: 0.16, mouthForm: 0.3, mouthShift: 0.24, mouthOpen: 0.08, mouthPucker: -0.14, mouthShrug: 0.24, tongueOut: 0.08 },
    actionRefs: [], overlayRefs: [], physicsPassthrough: [],
  },
  shy: {
    timeline: { introMs: 980, performMs: 5600, outroMs: 1300 },
    owns: ['gaze', 'eyes', 'mouth', 'pose', 'brows', 'specials'],
    entryState: { headPitch: -3.2, headRoll: 4.4, bodyYaw: -1.4, bodyRoll: 0.8, gazeY: 0.28, gazeX: -0.04, eyeOpenL: 0.62, eyeOpenR: 0.64, eyeSquintL: 0.08, eyeSquintR: 0.08, browLY: 0.14, browRY: 0.14, browLForm: -0.14, browRForm: -0.14, mouthForm: 0.12, mouthOpen: 0.04, mouthPucker: -0.14, mouthShrug: 0.18, cheekPuff: 0.08 },
    sustainedState: { headPitch: -6.2, headRoll: 8.4, bodyYaw: -2.6, bodyRoll: 2.2, gazeX: -0.12, gazeY: 0.58, eyeOpenL: 0.42, eyeOpenR: 0.46, eyeSquintL: 0.14, eyeSquintR: 0.14, browLY: 0.26, browRY: 0.26, browLForm: -0.28, browRForm: -0.28, browLAngle: 0.08, browRAngle: 0.08, mouthForm: 0.22, mouthOpen: 0.1, mouthPucker: -0.32, mouthShrug: 0.28, cheekPuff: 0.14 },
    actionRefs: [], overlayRefs: ['脸红'], physicsPassthrough: [],
  },
  embarrassed: {
    timeline: { introMs: 920, performMs: 6200, outroMs: 1300 },
    owns: ['brows', 'eyes', 'mouth', 'gaze', 'pose', 'specials'],
    entryState: { headPitch: -4.2, headYaw: 1.4, headRoll: -2.2, bodyYaw: 0.9, bodyRoll: -0.8, bodyLift: -0.3, gazeX: 0.08, gazeY: 0.62, eyeOpenL: 0.64, eyeOpenR: 0.68, eyeSquintL: 0.16, eyeSquintR: 0.16, browLY: -0.22, browRY: -0.22, browLAngle: 0.34, browRAngle: 0.34, browLForm: -0.2, browRForm: -0.2, mouthForm: 0.22, mouthShift: 0.16, mouthOpen: 0.18, mouthPucker: -0.24, mouthShrug: 0.32, cheekPuff: 0.06 },
    sustainedState: { headPitch: -7.4, headYaw: 2.4, headRoll: -3.8, bodyYaw: 1.6, bodyRoll: -1.4, bodyLift: -0.6, gazeX: 0.06, gazeY: 0.86, eyeOpenL: 0.5, eyeOpenR: 0.56, eyeSquintL: 0.24, eyeSquintR: 0.24, browLY: -0.34, browRY: -0.34, browLAngle: 0.52, browRAngle: 0.52, browLForm: -0.28, browRForm: -0.28, mouthForm: 0.34, mouthShift: 0.28, mouthOpen: 0.28, mouthPucker: -0.34, mouthShrug: 0.42, cheekPuff: 0.1 },
    actionRefs: [], overlayRefs: ['脸红'], physicsPassthrough: [],
  },
  awkwardV2: {
    timeline: { introMs: 880, performMs: 6800, outroMs: 1250 },
    owns: ['brows', 'eyes', 'mouth', 'gaze', 'pose', 'specials'],
    entryState: { headPitch: -3.8, headYaw: 1.1, headRoll: -1.2, bodyYaw: 0.8, bodyRoll: -0.6, bodyLift: -0.2, gazeX: 0.02, gazeY: 0.54, eyeOpenL: 0.68, eyeOpenR: 0.7, eyeSquintL: 0.12, eyeSquintR: 0.12, browLY: 0.16, browRY: 0.16, browLAngle: 0.02, browRAngle: 0.02, browLForm: -0.46, browRForm: -0.46, mouthForm: 0.2, mouthShift: 0.03, mouthOpen: 0.04, mouthPucker: -0.22, mouthShrug: 0.3, cheekPuff: 0.04 },
    sustainedState: { headPitch: -6.0, headYaw: 1.8, headRoll: -2.6, bodyYaw: 1.2, bodyRoll: -1.0, bodyLift: -0.4, gazeX: 0.04, gazeY: 0.78, eyeOpenL: 0.56, eyeOpenR: 0.6, eyeSquintL: 0.2, eyeSquintR: 0.2, browLY: 0.28, browRY: 0.28, browLAngle: 0.04, browRAngle: 0.04, browLForm: -0.62, browRForm: -0.62, mouthForm: 0.24, mouthShift: 0.04, mouthOpen: 0.05, mouthPucker: -0.3, mouthShrug: 0.38, cheekPuff: 0.08 },
    actionRefs: [], overlayRefs: ['脸红'], physicsPassthrough: [],
  },
  annoyed: {
    timeline: { introMs: 820, performMs: 5400, outroMs: 1200 },
    owns: ['brows', 'mouth', 'eyes', 'gaze', 'pose', 'specials'],
    entryState: { browLY: -0.22, browRY: -0.22, browLAngle: -0.32, browRAngle: -0.32, browLForm: -0.18, browRForm: -0.18, eyeOpenL: 0.82, eyeOpenR: 0.82, eyeSquintL: 0.06, eyeSquintR: 0.06, gazeX: 0.06, gazeY: -0.04, mouthForm: -0.18, mouthPucker: -0.12, mouthShrug: 0.18, cheekPuff: 0.08, headPitch: 1.2, headYaw: 1.2, bodyYaw: 1.2, bodyRoll: -0.4 },
    sustainedState: { browLY: -0.42, browRY: -0.42, browLAngle: -0.62, browRAngle: -0.62, browLForm: -0.22, browRForm: -0.22, eyeOpenL: 0.68, eyeOpenR: 0.68, eyeSquintL: 0.12, eyeSquintR: 0.12, gazeX: 0.12, gazeY: -0.08, mouthForm: -0.34, mouthShift: 0.14, mouthOpen: 0.08, mouthPucker: -0.22, mouthShrug: 0.24, cheekPuff: 0.22, headPitch: 2.4, headYaw: 2.8, bodyYaw: 2.6, bodyRoll: -0.8 },
    actionRefs: [], overlayRefs: ['黑脸'], physicsPassthrough: [],
  },
  poutyAnnoyed: {
    timeline: { introMs: 760, performMs: 5200, outroMs: 1200 },
    owns: ['brows', 'eyes', 'mouth', 'pose', 'gaze', 'specials'],
    entryState: { cheekPuff: 0.82, mouthForm: -0.22, mouthPucker: -0.36, mouthShrug: 0.38, eyeOpenL: 0.74, eyeOpenR: 0.74, eyeSquintL: 0.24, eyeSquintR: 0.24, eyeSize: -0.24, browLY: -0.54, browRY: -0.54, browLAngle: -0.42, browRAngle: -0.42, browLForm: -0.22, browRForm: -0.22, gazeY: 0.06, bow: 0.44, bowPress: 1, headPitch: 10, bodyLift: 5 },
    sustainedState: { cheekPuff: 1, mouthForm: -0.34, mouthPucker: -0.56, mouthShrug: 0.52, eyeOpenL: 0.62, eyeOpenR: 0.62, eyeSquintL: 0.36, eyeSquintR: 0.36, eyeSize: -0.44, browLY: -0.7, browRY: -0.7, browLAngle: -0.62, browRAngle: -0.62, browLForm: -0.3, browRForm: -0.3, gazeY: 0.1, bow: 0.68, bowPress: 1, headPitch: 16, bodyLift: 7 },
    actionRefs: [], overlayRefs: ['黑脸'], physicsPassthrough: [],
  },
  curious: {
    timeline: { introMs: 760, performMs: 5800, outroMs: 1100 },
    owns: ['brows', 'eyes', 'mouth', 'gaze', 'pose'],
    entryState: { headPitch: 0.6, headYaw: 1.6, headRoll: -1.2, bodyYaw: 0.7, bodyRoll: -0.3, bodyLift: 0.7, bow: 0.08, bowPress: 0.16, gazeX: 0.08, gazeY: 0.02, eyeOpenL: 0.84, eyeOpenR: 0.64, eyeSquintL: 0.05, eyeSquintR: 0.16, browLY: 0.08, browRY: -0.12, browLAngle: 0.26, browRAngle: -0.18, browLForm: 0.12, browRForm: -0.08, mouthForm: 0.12, mouthOpen: 0.08, jawOpen: 0.05, mouthShift: 0.03, mouthPucker: -0.18, mouthShrug: 0.24, cheekPuff: 0.02 },
    sustainedState: { headPitch: 1.4, headYaw: 2.8, headRoll: -2.2, bodyYaw: 1.1, bodyRoll: -0.5, bodyLift: 1.1, bow: 0.14, bowPress: 0.24, gazeX: 0.14, gazeY: 0.05, eyeOpenL: 0.88, eyeOpenR: 0.68, eyeSquintL: 0.06, eyeSquintR: 0.18, browLY: 0.12, browRY: -0.22, browLAngle: 0.42, browRAngle: -0.26, browLForm: 0.2, browRForm: -0.12, mouthForm: 0.18, mouthOpen: 0.14, jawOpen: 0.1, mouthShift: 0.06, mouthPucker: -0.26, mouthShrug: 0.36, cheekPuff: 0.04 },
    actionRefs: ['headLiftAlert', 'bodyLeanInSoft'], overlayRefs: [], physicsPassthrough: [],
  },
  tender: {
    timeline: { introMs: 900, performMs: 6400, outroMs: 1200 },
    owns: ['brows', 'eyes', 'mouth', 'gaze', 'pose'],
    entryState: { headPitch: 0.4, headYaw: -0.8, headRoll: -4.4, bodyYaw: -0.6, bodyRoll: -0.9, bodyLift: 0.6, bow: 0.08, gazeX: -0.03, gazeY: 0.02, eyeOpenL: 0.86, eyeOpenR: 0.86, eyeSquintL: 0.08, eyeSquintR: 0.08, eyeSmileL: 0.08, eyeSmileR: 0.08, browLY: 0.08, browRY: 0.08, browLForm: -0.08, browRForm: -0.08, mouthForm: 0.24, mouthOpen: 0.03, jawOpen: 0.02, mouthShift: -0.02, mouthPucker: -0.14, mouthShrug: 0.24, cheekPuff: 0.04 },
    sustainedState: { headPitch: 0.8, headYaw: -1.4, headRoll: -6.2, bodyYaw: -1.0, bodyRoll: -1.4, bodyLift: 0.85, bow: 0.12, gazeX: -0.04, gazeY: 0.04, eyeOpenL: 0.8, eyeOpenR: 0.8, eyeSquintL: 0.12, eyeSquintR: 0.12, eyeSmileL: 0.18, eyeSmileR: 0.18, browLY: 0.12, browRY: 0.12, browLForm: -0.14, browRForm: -0.14, mouthForm: 0.36, mouthOpen: 0.05, jawOpen: 0.03, mouthShift: -0.03, mouthPucker: -0.18, mouthShrug: 0.34, cheekPuff: 0.08 },
    actionRefs: ['slowBlinkAffection', 'bodySwayTenderSlow'], overlayRefs: ['脸红'], physicsPassthrough: [],
  },
  skeptical: {
    timeline: { introMs: 820, performMs: 5600, outroMs: 1100 },
    owns: ['brows', 'eyes', 'mouth', 'gaze', 'pose'],
    entryState: { headPitch: -0.4, headYaw: 3.2, headRoll: 1.8, bodyYaw: 1.4, bodyRoll: 0.4, bodyLift: -0.4, gazeX: 0.18, gazeY: 0.0, eyeOpenL: 0.72, eyeOpenR: 0.9, eyeSquintL: 0.14, eyeSquintR: 0.02, browLY: 0.22, browRY: -0.18, browLAngle: 0.28, browRAngle: -0.32, browLForm: 0.18, browRForm: -0.18, mouthForm: -0.12, mouthShift: 0.24, mouthPucker: -0.22, mouthShrug: 0.14, cheekPuff: 0.06 },
    sustainedState: { headPitch: -0.8, headYaw: 4.6, headRoll: 2.6, bodyYaw: 2.0, bodyRoll: 0.6, bodyLift: -0.7, gazeX: 0.24, gazeY: -0.02, eyeOpenL: 0.62, eyeOpenR: 0.86, eyeSquintL: 0.22, eyeSquintR: 0.04, browLY: 0.34, browRY: -0.28, browLAngle: 0.4, browRAngle: -0.46, browLForm: 0.22, browRForm: -0.26, mouthForm: -0.18, mouthShift: 0.38, mouthPucker: -0.3, mouthShrug: 0.2, cheekPuff: 0.1 },
    actionRefs: ['bodyLeanBackGuarded', 'lookAwayThenBack'], overlayRefs: [], physicsPassthrough: [],
  },
  smug: {
    timeline: { introMs: 720, performMs: 5400, outroMs: 1000 },
    owns: ['brows', 'eyes', 'mouth', 'gaze', 'pose'],
    entryState: { headPitch: -1.0, headYaw: 2.2, headRoll: -1.8, bodyYaw: 1.4, bodyRoll: -0.5, bodyLift: 0.4, gazeX: 0.14, gazeY: -0.02, eyeOpenL: 0.82, eyeOpenR: 0.72, eyeSquintL: 0.04, eyeSquintR: 0.1, browLY: -0.06, browRY: 0.14, browLAngle: -0.06, browRAngle: 0.22, browLForm: 0.08, browRForm: -0.12, mouthForm: 0.24, mouthOpen: 0.02, jawOpen: 0.02, mouthShift: 0.3, mouthPucker: -0.12, mouthShrug: 0.16, cheekPuff: 0.08 },
    sustainedState: { headPitch: -1.6, headYaw: 3.2, headRoll: -2.6, bodyYaw: 2.1, bodyRoll: -0.8, bodyLift: 0.6, gazeX: 0.18, gazeY: -0.04, eyeOpenL: 0.78, eyeOpenR: 0.62, eyeSquintL: 0.06, eyeSquintR: 0.14, browLY: -0.08, browRY: 0.2, browLAngle: -0.08, browRAngle: 0.28, browLForm: 0.1, browRForm: -0.16, mouthForm: 0.32, mouthOpen: 0.04, jawOpen: 0.04, mouthShift: 0.44, mouthPucker: -0.16, mouthShrug: 0.24, cheekPuff: 0.14 },
    actionRefs: ['bodyPresentRight'], overlayRefs: [], physicsPassthrough: [],
  },
  disappointed: {
    timeline: { introMs: 900, performMs: 6200, outroMs: 1300 },
    owns: ['brows', 'eyes', 'mouth', 'gaze', 'pose'],
    entryState: { headPitch: 2.8, headYaw: -0.8, headRoll: 1.4, bodyYaw: -0.5, bodyRoll: 0.2, bodyLift: -0.8, bow: 0.08, gazeX: -0.04, gazeY: 0.28, eyeOpenL: 0.64, eyeOpenR: 0.66, eyeSquintL: 0.08, eyeSquintR: 0.08, browLY: 0.08, browRY: 0.08, browLAngle: 0.18, browRAngle: 0.18, browLForm: -0.22, browRForm: -0.22, mouthForm: -0.12, mouthOpen: 0.05, jawOpen: 0.08, mouthShift: -0.02, mouthPucker: -0.16, mouthShrug: 0.24 },
    sustainedState: { headPitch: 4.6, headYaw: -1.2, headRoll: 2.2, bodyYaw: -0.8, bodyRoll: 0.4, bodyLift: -1.3, bow: 0.16, gazeX: -0.06, gazeY: 0.46, eyeOpenL: 0.52, eyeOpenR: 0.56, eyeSquintL: 0.12, eyeSquintR: 0.12, browLY: 0.14, browRY: 0.14, browLAngle: 0.26, browRAngle: 0.26, browLForm: -0.32, browRForm: -0.32, mouthForm: -0.26, mouthOpen: 0.08, jawOpen: 0.12, mouthShift: -0.03, mouthPucker: -0.24, mouthShrug: 0.36 },
    actionRefs: ['sighRelease', 'headLowerShy'], overlayRefs: ['泪汪汪'], physicsPassthrough: [],
  },
} satisfies Record<string, EmotionDef>;

export type EmotionId = keyof typeof EMOTIONS;

// Idle (待机) profiles — the procedural resting-state body language. Ported from
// Python js/runtime/layers/idle-profiles.js (the awake set; the Python `sleep`
// profile is covered here by the 'sleeping' Live2DState, so it isn't duplicated).
// The per-profile motion is procedural sine math living in faceVm.ts (applyIdle),
// matching Python (these are generated, not keyframe assets); this list is the
// registry the settings switcher reads.
export type IdleProfileId =
  | 'defaultIdleV1'
  | 'cuteSwayV1'
  | 'peekyIdleV1'
  | 'shyDriftV1'
  | 'sweetBounceV1';

export const IDLE_PROFILES: ReadonlyArray<{ id: IdleProfileId; label: string }> = [
  { id: 'defaultIdleV1', label: 'Default' },
  { id: 'cuteSwayV1', label: 'Cute sway' },
  { id: 'peekyIdleV1', label: 'Peek' },
  { id: 'shyDriftV1', label: 'Shy drift' },
  { id: 'sweetBounceV1', label: 'Sweet bounce' },
];

export const IDLE_PROFILE_IDS: readonly string[] = IDLE_PROFILES.map((p) => p.id);
export const DEFAULT_IDLE_PROFILE: IdleProfileId = 'defaultIdleV1';

// 9 actions referenced by the emotions above (action-library.js). Keyframe `at`
// is 0..1 progress; `value` is the raw param value, multiplied by intensity.
export const ACTIONS: Record<string, ActionDef> = {
  headLiftAlert: { durationMs: 780, tracks: { headPitch: [{ at: 0, value: 0 }, { at: 0.28, value: -18 }, { at: 0.72, value: -11 }, { at: 1, value: 0 }], headYaw: [{ at: 0, value: 0 }, { at: 0.28, value: 1.2 }, { at: 0.72, value: 0.5 }, { at: 1, value: 0 }] } },
  bodyLeanInSoft: { durationMs: 1080, tracks: { bodyLift: [{ at: 0, value: 0 }, { at: 0.32, value: 11 }, { at: 0.82, value: 7.5 }, { at: 1, value: 0 }], bow: [{ at: 0, value: 0 }, { at: 0.32, value: 0.56 }, { at: 0.82, value: 0.38 }, { at: 1, value: 0 }], bowPress: [{ at: 0, value: 0 }, { at: 0.22, value: 1 }, { at: 0.82, value: 0.82 }, { at: 1, value: 0 }], bodyYaw: [{ at: 0, value: 0 }, { at: 0.32, value: 1.2 }, { at: 0.82, value: 0.6 }, { at: 1, value: 0 }] } },
  slowBlinkAffection: { durationMs: 1240, tracks: { eyeOpenL: [{ at: 0, value: 1 }, { at: 0.28, value: 0.48 }, { at: 0.5, value: 0.08 }, { at: 0.74, value: 0.44 }, { at: 1, value: 0.82 }], eyeOpenR: [{ at: 0, value: 1 }, { at: 0.28, value: 0.5 }, { at: 0.5, value: 0.1 }, { at: 0.74, value: 0.46 }, { at: 1, value: 0.84 }], eyeSquintL: [{ at: 0, value: 0.02 }, { at: 0.28, value: 0.22 }, { at: 0.5, value: 0.34 }, { at: 0.74, value: 0.18 }, { at: 1, value: 0.08 }], eyeSquintR: [{ at: 0, value: 0.02 }, { at: 0.28, value: 0.22 }, { at: 0.5, value: 0.34 }, { at: 0.74, value: 0.18 }, { at: 1, value: 0.08 }], eyeSmileL: [{ at: 0, value: 0.04 }, { at: 0.3, value: 0.12 }, { at: 0.56, value: 0.22 }, { at: 0.82, value: 0.16 }, { at: 1, value: 0.08 }], eyeSmileR: [{ at: 0, value: 0.04 }, { at: 0.3, value: 0.12 }, { at: 0.56, value: 0.22 }, { at: 0.82, value: 0.16 }, { at: 1, value: 0.08 }], headRoll: [{ at: 0, value: 0 }, { at: 0.34, value: -2.6 }, { at: 0.76, value: -1.2 }, { at: 1, value: 0 }], mouthForm: [{ at: 0, value: 0.08 }, { at: 0.36, value: 0.12 }, { at: 0.78, value: 0.1 }, { at: 1, value: 0.06 }] } },
  bodySwayTenderSlow: { durationMs: 3920, tracks: { bodyRoll: [{ at: 0, value: 0 }, { at: 0.22, value: -4.2 }, { at: 0.5, value: 5.0 }, { at: 0.8, value: -2.2 }, { at: 1, value: 0 }], bodyYaw: [{ at: 0, value: 0 }, { at: 0.22, value: -2.0 }, { at: 0.5, value: 2.4 }, { at: 0.8, value: -1.0 }, { at: 1, value: 0 }], bodyLift: [{ at: 0, value: 0 }, { at: 0.22, value: 0.56 }, { at: 0.5, value: 1.1 }, { at: 0.8, value: 0.34 }, { at: 1, value: 0 }] } },
  bodyLeanBackGuarded: { durationMs: 1040, tracks: { bodyLift: [{ at: 0, value: 0 }, { at: 0.32, value: -8.5 }, { at: 0.8, value: -5.2 }, { at: 1, value: 0 }], bodyRoll: [{ at: 0, value: 0 }, { at: 0.32, value: -1.4 }, { at: 0.8, value: -0.6 }, { at: 1, value: 0 }], bodyYaw: [{ at: 0, value: 0 }, { at: 0.32, value: -0.8 }, { at: 0.8, value: -0.4 }, { at: 1, value: 0 }] } },
  lookAwayThenBack: { durationMs: 1380, tracks: { gazeX: [{ at: 0, value: 0 }, { at: 0.26, value: 0.22 }, { at: 0.52, value: 0.34 }, { at: 0.78, value: 0.1 }, { at: 1, value: 0 }], gazeY: [{ at: 0, value: 0 }, { at: 0.26, value: 0.12 }, { at: 0.52, value: 0.18 }, { at: 0.78, value: 0.06 }, { at: 1, value: 0 }], headYaw: [{ at: 0, value: 0 }, { at: 0.26, value: 4.8 }, { at: 0.52, value: 6.2 }, { at: 0.78, value: 1.8 }, { at: 1, value: 0 }], headRoll: [{ at: 0, value: 0 }, { at: 0.26, value: 1.2 }, { at: 0.52, value: 2.1 }, { at: 0.78, value: 0.6 }, { at: 1, value: 0 }], eyeOpenL: [{ at: 0, value: 0.92 }, { at: 0.3, value: 0.76 }, { at: 0.58, value: 0.68 }, { at: 0.82, value: 0.86 }, { at: 1, value: 0.92 }], eyeOpenR: [{ at: 0, value: 0.92 }, { at: 0.3, value: 0.8 }, { at: 0.58, value: 0.7 }, { at: 0.82, value: 0.88 }, { at: 1, value: 0.92 }] } },
  bodyPresentRight: { durationMs: 980, tracks: { bodyYaw: [{ at: 0, value: 0 }, { at: 0.32, value: 6.2 }, { at: 0.78, value: 3.6 }, { at: 1, value: 0 }], bodyRoll: [{ at: 0, value: 0 }, { at: 0.32, value: 2.6 }, { at: 0.78, value: 1.2 }, { at: 1, value: 0 }], bodyLift: [{ at: 0, value: 0 }, { at: 0.32, value: 1.2 }, { at: 0.78, value: 0.6 }, { at: 1, value: 0 }] } },
  sighRelease: { durationMs: 1460, tracks: { mouthOpen: [{ at: 0, value: 0 }, { at: 0.24, value: 0.22 }, { at: 0.5, value: 0.14 }, { at: 0.82, value: 0.03 }, { at: 1, value: 0 }], jawOpen: [{ at: 0, value: 0 }, { at: 0.24, value: 0.28 }, { at: 0.5, value: 0.16 }, { at: 0.82, value: 0.04 }, { at: 1, value: 0 }], mouthForm: [{ at: 0, value: 0 }, { at: 0.24, value: -0.04 }, { at: 0.5, value: -0.18 }, { at: 0.82, value: -0.08 }, { at: 1, value: 0 }], mouthPucker: [{ at: 0, value: 0 }, { at: 0.24, value: -0.04 }, { at: 0.5, value: -0.12 }, { at: 0.82, value: -0.04 }, { at: 1, value: 0 }], headPitch: [{ at: 0, value: 0 }, { at: 0.24, value: 3.8 }, { at: 0.5, value: 5.8 }, { at: 0.82, value: 1.2 }, { at: 1, value: 0 }], bodyLift: [{ at: 0, value: 0 }, { at: 0.24, value: -1.2 }, { at: 0.5, value: -1.8 }, { at: 0.82, value: -0.4 }, { at: 1, value: 0 }], gazeY: [{ at: 0, value: 0 }, { at: 0.24, value: 0.08 }, { at: 0.5, value: 0.18 }, { at: 0.82, value: 0.04 }, { at: 1, value: 0 }] } },
  headLowerShy: { durationMs: 920, tracks: { headPitch: [{ at: 0, value: 0 }, { at: 0.34, value: 11 }, { at: 0.78, value: 6.5 }, { at: 1, value: 0 }], headRoll: [{ at: 0, value: 0 }, { at: 0.34, value: 4.2 }, { at: 0.78, value: 2.0 }, { at: 1, value: 0 }] } },
};
