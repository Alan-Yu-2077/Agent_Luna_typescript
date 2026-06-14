// Canonical FaceVM state → Cubism parameter-id map + neutral defaults, ported
// verbatim from Python js/runtime/config.js (FACE_VM_PARAM_MAP / FACE_VM_DEFAULT_STATE).
// Values are RAW Cubism parameter values (angles ~±30, eye/mouth 0..1, brow ~-1..1).

export const FACE_VM_PARAM_MAP = {
  headPitch: 'ParamAngleY',
  headYaw: 'ParamAngleX',
  headRoll: 'ParamAngleZ',
  bodyYaw: 'ParamBodyAngleX',
  bodyLift: 'ParamBodyAngleY',
  bodyRoll: 'ParamBodyAngleZ',
  bow: 'Paramdown',
  bowPress: 'Paramdown1',
  gazeX: 'ParamEyeBallX',
  gazeY: 'ParamEyeBallY',
  eyeOpenL: 'ParamEyeOpenL',
  eyeOpenR: 'ParamEyeOpenR',
  eyeSmileL: 'ParamEyeSmileL',
  eyeSmileR: 'ParamEyeSmileR',
  eyeSquintL: 'ParameyesSquintL',
  eyeSquintR: 'ParameyesSquintR',
  eyeSize: 'Parammetamasize',
  mouthOpen: 'ParamMouthOpenY',
  jawOpen: 'ParamJawOpen',
  mouthForm: 'ParamMouthForm',
  mouthShift: 'ParamMouthX',
  mouthShrug: 'ParamMouthShrug',
  mouthPucker: 'ParamMouthpucker',
  cheekPuff: 'ParamCheekpuff',
  tongueOut: 'Paramshita',
  browLY: 'ParamBrowYL',
  browRY: 'ParamBrowYR',
  browLX: 'ParamBrowXL',
  browRX: 'ParamBrowXR',
  browLAngle: 'ParamBrowAngleL',
  browRAngle: 'ParamBrowAngleR',
  browLForm: 'ParamBrowFormL',
  browRForm: 'ParamBrowFormR',
} as const satisfies Record<string, string>;

export type FaceStateKey = keyof typeof FACE_VM_PARAM_MAP;

export const FACE_STATE_KEYS = Object.keys(FACE_VM_PARAM_MAP) as FaceStateKey[];

export const FACE_VM_DEFAULT_STATE: Record<FaceStateKey, number> = {
  headPitch: 0, headYaw: 0, headRoll: 0,
  bodyYaw: 0, bodyLift: 0, bodyRoll: 0,
  bow: 0, bowPress: 0,
  gazeX: 0, gazeY: 0,
  eyeOpenL: 1, eyeOpenR: 1,
  eyeSmileL: 0, eyeSmileR: 0,
  eyeSquintL: 0, eyeSquintR: 0,
  eyeSize: 0,
  mouthOpen: 0, jawOpen: 0, mouthForm: 0, mouthShift: 0, mouthShrug: 0, mouthPucker: 0,
  cheekPuff: 0, tongueOut: 0,
  browLY: 0, browRY: 0, browLX: 0, browRX: 0,
  browLAngle: 0, browRAngle: 0, browLForm: 0, browRForm: 0,
};
