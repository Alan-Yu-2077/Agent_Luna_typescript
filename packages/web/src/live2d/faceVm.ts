import type { ExpressionKey } from '@luna/protocol';
import type { Live2DState } from '../sinks';
import {
  FACE_STATE_KEYS,
  FACE_VM_DEFAULT_STATE,
  FACE_VM_PARAM_MAP,
  type FaceStateKey,
} from './paramMap';
import { expressionParams, type Pose } from './expressionMap';

// First-cut FaceVM: overlays a state bias + the active expression (+ lip-sync
// mouth) onto neutral, smoothing each frame and writing only the DISPLACED
// params so the model's built-in blink/breath idle shows through. The full
// layered engine (idle profiles, emotion timelines, action keyframes) is v0.13.2.

export interface ParamWriter {
  setParam(id: string, value: number): void;
}

const STATE_BIAS: Record<Live2DState, Pose> = {
  neutral: {},
  thinking: { headPitch: -6, gazeY: -0.4, browLForm: -0.3, browRForm: -0.3, eyeOpenL: 0.85, eyeOpenR: 0.85 },
  speaking: { headPitch: 2 },
  sleeping: { eyeOpenL: 0, eyeOpenR: 0, headPitch: -10, headRoll: 6 },
};

export class FaceVm {
  private readonly cur: Record<FaceStateKey, number> = { ...FACE_VM_DEFAULT_STATE };
  private state: Live2DState = 'neutral';
  private expr: Pose = {};
  private mouth = 0;

  constructor(private readonly writer: ParamWriter) {}

  setState(state: Live2DState): void {
    this.state = state;
  }
  setExpression(key: ExpressionKey, emotion = 0.6): void {
    this.expr = expressionParams(key, emotion);
  }
  setMouth(value: number): void {
    this.mouth = Math.max(0, Math.min(1, value));
  }
  clear(): void {
    this.expr = {};
    this.state = 'neutral';
    this.mouth = 0;
  }

  // `_now` is accepted for deterministic testing / future idle drivers.
  tick(_now: number): void {
    const target: Record<FaceStateKey, number> = { ...FACE_VM_DEFAULT_STATE };
    apply(target, STATE_BIAS[this.state]);
    apply(target, this.expr);
    if (this.state === 'speaking') target.mouthOpen = Math.max(target.mouthOpen, this.mouth);

    const sm = this.state === 'sleeping' ? 0.06 : 0.2;
    for (const key of FACE_STATE_KEYS) {
      const def = FACE_VM_DEFAULT_STATE[key];
      this.cur[key] += (target[key] - this.cur[key]) * sm;
      if (Math.abs(this.cur[key] - def) > 1e-3) this.writer.setParam(FACE_VM_PARAM_MAP[key], this.cur[key]);
    }
  }
}

function apply(target: Record<FaceStateKey, number>, pose: Pose): void {
  for (const k of Object.keys(pose) as FaceStateKey[]) {
    const v = pose[k];
    if (v !== undefined) target[k] = v;
  }
}
