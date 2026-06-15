import type { ExpressionKey } from '@luna/protocol';
import type { Live2DState, LipSyncFrame } from '../sinks';
import {
  FACE_STATE_KEYS,
  FACE_VM_DEFAULT_STATE,
  FACE_VM_PARAM_MAP,
  clampStateValue,
  type FaceStateKey,
} from './paramMap';
import {
  ACTIONS,
  ALL_OVERLAY_PARAMS,
  EMOTIONS,
  EMOTION_SOFT_BLEND_WEIGHTS,
  FACE_CHANNEL_GROUPS,
  FACE_PARAM_GAIN,
  OVERLAYS,
  type ActionDef,
  type EmotionDef,
  type EmotionId,
  type Keyframe,
  type Pose,
} from './faceData';
import { affectToEmotion } from './expressionMap';

// The high-fidelity FaceVM (v0.13.2) — a faithful port of Python's layered
// engine. Per tick: state bias → emotion (intro→perform→outro, soft-blend vs
// hard-replace, channel ownership) → staggered actions → smoothing → flush with
// gains + clamps + overlay special-params. Deterministic: all timing comes from
// the `now` passed to tick(); setExpression queues a pending change consumed on
// the next tick so it shares the same clock. (Per-emotion sine micro-motion +
// the 6 procedural idle profiles are deferred; the model's built-in idle carries
// neutral, and we only write displaced params so blink/breath show through.)

export interface ParamWriter {
  setParam(id: string, value: number): void;
}

type Phase = 'intro' | 'perform' | 'outro' | 'inactive';
type Stage = { phase: Phase; weight: number };
type Playback = {
  id: EmotionId;
  intensity: number;
  startedAt: number;
  introMs: number;
  performMs: number;
  outroMs: number;
  entrySnapshot: Pose;
  outroStartAt: number | null;
  actionsQueued: boolean;
};
type ActionInstance = { action: ActionDef; startAt: number; intensity: number };

const SOFT_BLEND_KEYS = new Set(Object.keys(EMOTION_SOFT_BLEND_WEIGHTS) as FaceStateKey[]);

// The 4 mouth params the lip-sync owns while speaking (and that we always write
// when idle so they can't freeze at the last spoken value).
const MOUTH_KEYS: readonly FaceStateKey[] = ['mouthOpen', 'mouthForm', 'mouthShrug', 'mouthPucker'];

// The head/body "pose" channel — ParamAngle*/ParamBodyAngle*/bow are PHYSICS-INPUT
// on this model: the deform reads them BEFORE physics runs, so writing them at
// 'beforeModelUpdate' (after physics) never deforms. They're flushed separately at
// 'afterMotionUpdate' (pre-physics); the main loop here only smooths them.
const POSE_KEYS: readonly FaceStateKey[] = FACE_CHANNEL_GROUPS.pose;
const POSE_SET = new Set<FaceStateKey>(POSE_KEYS);

// Simple state-layer biases (kept from v0.13.1; rich speaking/thinking procedural
// motion is deferred). Applied additively-as-set, skipping emotion-owned keys.
const STATE_BIAS: Record<Live2DState, Pose> = {
  neutral: {},
  thinking: { headPitch: -6, gazeY: -0.4, browLForm: -0.3, browRForm: -0.3, eyeOpenL: 0.85, eyeOpenR: 0.85 },
  speaking: { headPitch: 2 },
  sleeping: { eyeOpenL: 0, eyeOpenR: 0, headPitch: -10, headRoll: 6 },
};

export class FaceVm {
  private readonly cur: Record<FaceStateKey, number> = { ...FACE_VM_DEFAULT_STATE };
  private state: Live2DState = 'neutral';
  private lip: LipSyncFrame | null = null;
  private playback: Playback | null = null;
  private readonly actions = new Map<string, ActionInstance>();
  private pending: { id: EmotionId | null; intensity: number } | undefined;

  constructor(private readonly writer: ParamWriter) {}

  setState(state: Live2DState): void {
    this.state = state;
  }
  // Lip-sync owns the mouth while speaking: a frame overrides the 4 mouth params
  // (raw, post-emotion, no extra smoothing — it's already smoothed); null releases
  // the mouth back to the emotion/idle layer.
  setMouth(frame: LipSyncFrame | null): void {
    this.lip = frame;
  }

  // Writes the head/body pose at 'afterMotionUpdate' (pre-physics) so it actually
  // deforms — those params are physics-input. Uses the value tick() smoothed last
  // frame (1-frame lag, imperceptible). gaze (focusController) adds on top after.
  flushPose(): void {
    for (const key of POSE_KEYS) {
      if (Math.abs(this.cur[key] - FACE_VM_DEFAULT_STATE[key]) > 1e-3) {
        this.writer.setParam(FACE_VM_PARAM_MAP[key], clampStateValue(key, this.cur[key] * (FACE_PARAM_GAIN[key] ?? 1)));
      }
    }
  }
  setExpression(key: ExpressionKey, emotion = 0.95): void {
    this.pending = { id: affectToEmotion(key), intensity: clamp01(emotion) };
  }
  // Dev / manual trigger: play a named emotion directly (bypassing affect→emotion
  // mapping) so every preset performance is visibly triggerable. Guards bad ids.
  triggerEmotion(id: string, intensity = 0.95): void {
    if (!(id in EMOTIONS)) return;
    this.pending = { id: id as EmotionId, intensity: clamp01(intensity) };
  }
  listEmotions(): string[] {
    return Object.keys(EMOTIONS);
  }
  clear(): void {
    this.pending = { id: null, intensity: 0 };
    this.state = 'neutral';
    this.lip = null;
  }

  tick(now: number): void {
    this.consumePending(now);
    this.updatePlayback(now);

    const target: Record<FaceStateKey, number> = { ...FACE_VM_DEFAULT_STATE };
    const owned = this.ownedKeys(now);
    applyPose(target, STATE_BIAS[this.state], owned);
    this.applyEmotion(target, now);
    this.applyActions(target, now);

    const sm = this.state === 'sleeping' ? 0.34 : this.state === 'thinking' ? 0.24 : 0.18;
    for (const key of FACE_STATE_KEYS) {
      const def = FACE_VM_DEFAULT_STATE[key];
      let next = this.cur[key] + (target[key] - this.cur[key]) * sm;
      if (Math.abs(target[key] - next) < 0.001) next = target[key];
      this.cur[key] = next;
      if (POSE_SET.has(key)) continue; // smoothed here, but written pre-physics in flushPose()
      if (Math.abs(next - def) > 1e-3) {
        const gain = FACE_PARAM_GAIN[key] ?? 1;
        this.writer.setParam(FACE_VM_PARAM_MAP[key], clampStateValue(key, next * gain));
      }
    }

    const overlay = this.overlayParams(now);
    for (const pid of ALL_OVERLAY_PARAMS) this.writer.setParam(pid, overlay[pid] ?? 0);

    // Mouth ownership: while speaking, the lip-sync frame owns the 4 mouth params
    // (raw, already-smoothed values, written last so they win over the emotion/idle
    // mouth — mouth params are direct deformers, not physics-driven like head/body).
    // When NOT speaking we still write them UNCONDITIONALLY from the smoothed
    // emotion/idle value (with gain), so a just-ended utterance can't leave the
    // mouth frozen at its last open value (the gated main loop won't rewrite a
    // near-default param).
    if (this.lip) {
      this.writer.setParam(FACE_VM_PARAM_MAP.mouthOpen, clampStateValue('mouthOpen', this.lip.open));
      this.writer.setParam(FACE_VM_PARAM_MAP.mouthForm, clampStateValue('mouthForm', this.lip.form));
      this.writer.setParam(FACE_VM_PARAM_MAP.mouthShrug, clampStateValue('mouthShrug', this.lip.shrug));
      this.writer.setParam(FACE_VM_PARAM_MAP.mouthPucker, clampStateValue('mouthPucker', this.lip.pucker));
    } else {
      for (const k of MOUTH_KEYS) {
        this.writer.setParam(FACE_VM_PARAM_MAP[k], clampStateValue(k, this.cur[k] * (FACE_PARAM_GAIN[k] ?? 1)));
      }
    }
  }

  private consumePending(now: number): void {
    if (this.pending === undefined) return;
    const { id, intensity } = this.pending;
    this.pending = undefined;
    if (!id) {
      if (this.playback && this.playback.outroStartAt === null) this.playback.outroStartAt = now;
      return;
    }
    const def: EmotionDef = EMOTIONS[id];
    this.playback = {
      id,
      intensity,
      startedAt: now,
      introMs: def.timeline.introMs,
      performMs: def.timeline.performMs,
      outroMs: def.timeline.outroMs,
      entrySnapshot: this.snapshot(id),
      outroStartAt: null,
      actionsQueued: false,
    };
  }

  private updatePlayback(now: number): void {
    const pb = this.playback;
    if (pb) {
      const stage = this.stage(now);
      if (stage.phase === 'perform' && !pb.actionsQueued) {
        this.queueActions(pb);
        pb.actionsQueued = true;
      }
      if (stage.phase === 'perform' && pb.outroStartAt === null && now >= pb.startedAt + pb.introMs + pb.performMs) {
        pb.outroStartAt = now;
      } else if (stage.phase === 'inactive') {
        this.playback = null;
      }
    }
    for (const [name, inst] of this.actions) {
      if ((now - inst.startAt) / inst.action.durationMs > 1) this.actions.delete(name);
    }
  }

  private stage(now: number): Stage {
    const pb = this.playback;
    if (!pb) return { phase: 'inactive', weight: 0 };
    if (pb.outroStartAt !== null) {
      const p = clamp01((now - pb.outroStartAt) / Math.max(1, pb.outroMs));
      if (p >= 1) return { phase: 'inactive', weight: 0 };
      return { phase: 'outro', weight: easeInOutSine(p) };
    }
    if (now < pb.startedAt + pb.introMs) {
      return { phase: 'intro', weight: easeInOutSine(clamp01((now - pb.startedAt) / Math.max(1, pb.introMs))) };
    }
    return { phase: 'perform', weight: 1 };
  }

  private applyEmotion(target: Record<FaceStateKey, number>, now: number): void {
    const blended = this.blendedState(now);
    for (const k of Object.keys(blended) as FaceStateKey[]) {
      const value = blended[k];
      if (value === undefined) continue;
      const w = EMOTION_SOFT_BLEND_WEIGHTS[k];
      if (w !== undefined) target[k] = lerp(target[k], value, w);
      else target[k] = value;
    }
  }

  private blendedState(now: number): Pose {
    const pb = this.playback;
    if (!pb) return {};
    const stage = this.stage(now);
    if (stage.phase === 'inactive') return {};
    const def: EmotionDef = EMOTIONS[pb.id];
    const keys = new Set<FaceStateKey>([
      ...(Object.keys(def.entryState) as FaceStateKey[]),
      ...(Object.keys(def.sustainedState) as FaceStateKey[]),
    ]);
    const out: Pose = {};
    for (const k of keys) {
      const base = FACE_VM_DEFAULT_STATE[k];
      let raw: number;
      if (stage.phase === 'intro') {
        const to = def.entryState[k] ?? def.sustainedState[k] ?? base;
        const from = pb.entrySnapshot[k] ?? base;
        raw = lerp(from, to, stage.weight);
      } else if (stage.phase === 'perform') {
        raw = def.sustainedState[k] ?? def.entryState[k] ?? base;
      } else {
        const from = def.sustainedState[k] ?? def.entryState[k] ?? base;
        raw = lerp(from, base, stage.weight);
      }
      out[k] = lerp(base, raw, pb.intensity); // affect intensity scales expression strength
    }
    return out;
  }

  private applyActions(target: Record<FaceStateKey, number>, now: number): void {
    for (const inst of this.actions.values()) {
      const progress = (now - inst.startAt) / inst.action.durationMs;
      if (progress < 0 || progress > 1) continue;
      for (const k of Object.keys(inst.action.tracks) as FaceStateKey[]) {
        const kfs = inst.action.tracks[k];
        if (kfs) target[k] = sampleTrack(kfs, progress) * inst.intensity;
      }
    }
  }

  private queueActions(pb: Playback): void {
    EMOTIONS[pb.id].actionRefs.forEach((name, i) => {
      const action = ACTIONS[name];
      if (!action) return;
      this.actions.set(`${pb.id}:${name}:${i}`, {
        action,
        startAt: pb.startedAt + pb.introMs + i * 110,
        intensity: 0.95,
      });
    });
  }

  private ownedKeys(now: number): Set<FaceStateKey> {
    const owned = new Set<FaceStateKey>();
    const pb = this.playback;
    if (!pb || this.stage(now).phase === 'inactive') return owned;
    const def: EmotionDef = EMOTIONS[pb.id];
    for (const ch of def.owns) for (const k of FACE_CHANNEL_GROUPS[ch]) if (!SOFT_BLEND_KEYS.has(k)) owned.add(k);
    for (const k of Object.keys(def.entryState) as FaceStateKey[]) if (!SOFT_BLEND_KEYS.has(k)) owned.add(k);
    for (const k of Object.keys(def.sustainedState) as FaceStateKey[]) if (!SOFT_BLEND_KEYS.has(k)) owned.add(k);
    return owned;
  }

  private snapshot(id: EmotionId): Pose {
    const def: EmotionDef = EMOTIONS[id];
    const owned = new Set<FaceStateKey>();
    for (const ch of def.owns) for (const k of FACE_CHANNEL_GROUPS[ch]) owned.add(k);
    for (const k of Object.keys(def.entryState) as FaceStateKey[]) owned.add(k);
    for (const k of Object.keys(def.sustainedState) as FaceStateKey[]) owned.add(k);
    const snap: Pose = {};
    for (const k of owned) snap[k] = this.cur[k];
    return snap;
  }

  private overlayParams(now: number): Record<string, number> {
    const out: Record<string, number> = {};
    const pb = this.playback;
    if (!pb) return out;
    const def: EmotionDef = EMOTIONS[pb.id];
    if (!def.overlayRefs.length) return out;
    const stage = this.stage(now);
    const w = stage.phase === 'perform' ? 1 : stage.phase === 'intro' || stage.phase === 'outro' ? stage.weight : 0;
    for (const ref of def.overlayRefs) {
      const ov = OVERLAYS[ref];
      if (!ov) continue;
      for (const [pid, base] of Object.entries(ov)) out[pid] = base * w;
    }
    return out;
  }
}

function applyPose(target: Record<FaceStateKey, number>, pose: Pose, owned: Set<FaceStateKey>): void {
  for (const k of Object.keys(pose) as FaceStateKey[]) {
    if (owned.has(k)) continue;
    const v = pose[k];
    if (v !== undefined) target[k] = v;
  }
}

function sampleTrack(kfs: Keyframe[], progress: number): number {
  const first = kfs[0];
  if (!first) return 0;
  if (progress <= first.at) return first.value;
  for (let i = 0; i < kfs.length - 1; i++) {
    const l = kfs[i];
    const r = kfs[i + 1];
    if (l && r && progress >= l.at && progress <= r.at) {
      const range = r.at - l.at || 1;
      return l.value + (r.value - l.value) * easeInOutSine((progress - l.at) / range);
    }
  }
  return kfs[kfs.length - 1]?.value ?? 0;
}

function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
