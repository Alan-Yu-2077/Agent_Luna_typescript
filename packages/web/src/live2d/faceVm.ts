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
  DEFAULT_IDLE_PROFILE,
  EMOTIONS,
  EMOTION_SOFT_BLEND_WEIGHTS,
  FACE_CHANNEL_GROUPS,
  FACE_PARAM_GAIN,
  IDLE_PROFILES,
  IDLE_PROFILE_IDS,
  OVERLAYS,
  type ActionDef,
  type EmotionDef,
  type EmotionId,
  type IdleProfileId,
  type Keyframe,
  type Pose,
} from './faceData';
import { affectToEmotion } from './expressionMap';

// The high-fidelity FaceVM (v0.13.2) — a faithful port of Python's layered
// engine. Per tick: idle profile (procedural resting motion) → state bias →
// emotion (intro→perform→outro, soft-blend vs hard-replace, channel ownership) →
// staggered actions → smoothing → flush with gains + clamps + overlay
// special-params. Deterministic given the `now` passed to tick(), EXCEPT the idle
// look-wander, which uses an injectable rng (default Math.random); setExpression
// queues a pending change consumed on the next tick so it shares the same clock.
//
// v0.13.13: the 5 awake idle profiles (defaultIdleV1/cuteSwayV1/peekyIdleV1/
// shyDriftV1/sweetBounceV1) are ported from Python applyIdle and selectable in
// settings. To preserve the two systems we tuned earlier, the idle deliberately
// does NOT drive the eyes (the model's built-in eyeBlink keeps blinking) and
// drives the gaze (ParamEyeBall*) ONLY when mouse gaze-follow is off — when it's
// on, the focusController owns the eyes. Head/body pose is flushed pre-physics and
// ADDS with the focusController, so idle sway + mouse look-at coexist.

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

// Idle layer: the eyes are left to the model's built-in blink (writing eyeOpen
// every frame would kill blinking), and the mouth channel yields to the lip-sync
// frame while speaking. CAT_ACCENT profiles get the occasional cat-mouth (=ω=).
const IDLE_EYE_SKIP = new Set<FaceStateKey>([
  'eyeOpenL', 'eyeOpenR', 'eyeSquintL', 'eyeSquintR', 'eyeSize', 'eyeSmileL', 'eyeSmileR',
]);
const MOUTH_CHANNEL = new Set<FaceStateKey>(FACE_CHANNEL_GROUPS.mouth);
const GAZE_KEYS = new Set<FaceStateKey>(['gazeX', 'gazeY']);
const CAT_ACCENT_IDLE = new Set<IdleProfileId>(['defaultIdleV1', 'cuteSwayV1', 'sweetBounceV1']);

type IdleLook = {
  fromX: number; fromY: number; toX: number; toY: number;
  moveStart: number; moveDuration: number; holdUntil: number;
  catMouthStartAt: number; catMouthUntil: number; catMouthNextAt: number;
};

export type FaceVmOptions = {
  rng?: () => number;
  idleProfile?: IdleProfileId;
  gazeActive?: boolean;
};

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

  private readonly rng: () => number;
  private idleProfile: IdleProfileId;
  private gazeActive: boolean;
  private idleStartedAt = -1; // <0 = (re)initialize on the next tick
  private idleLook: IdleLook | null = null;

  constructor(
    private readonly writer: ParamWriter,
    opts: FaceVmOptions = {},
  ) {
    this.rng = opts.rng ?? (() => Math.random());
    this.idleProfile = opts.idleProfile ?? DEFAULT_IDLE_PROFILE;
    this.gazeActive = opts.gazeActive ?? true;
  }

  setState(state: Live2DState): void {
    this.state = state;
  }

  // Switch the resting-state idle animation. Unknown ids are ignored (guarded).
  setIdleProfile(id: string): void {
    if (!IDLE_PROFILE_IDS.includes(id) || id === this.idleProfile) return;
    this.idleProfile = id as IdleProfileId;
    this.idleStartedAt = -1; // restart the idle clock + look wander for a clean cut
  }
  getIdleProfile(): IdleProfileId {
    return this.idleProfile;
  }
  listIdleProfiles(): ReadonlyArray<{ id: string; label: string }> {
    return IDLE_PROFILES;
  }
  // When mouse gaze-follow is on, the focusController owns the eyes, so the idle
  // must not write gaze; off, the idle wanders the gaze itself.
  setGazeActive(on: boolean): void {
    this.gazeActive = on;
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
    this.applyIdle(target, now, owned); // lowest layer — state/emotion/actions override
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
      // When mouse gaze-follow owns the eyes, the focusController is authoritative —
      // emotion/action gaze must not overwrite it (mirrors the applyIdle gate, so
      // the eyeballs stay owned regardless of which layer set the gaze target).
      if (this.gazeActive && GAZE_KEYS.has(key)) continue;
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

  // --- Idle profiles (ported from Python face-vm.js applyIdle + idle look state) ---

  private randomBetween(lo: number, hi: number): number {
    return lo + this.rng() * (hi - lo);
  }

  private createIdleLook(now: number): IdleLook {
    return {
      fromX: 0,
      fromY: 0,
      toX: this.randomBetween(-0.5, 0.5),
      toY: this.randomBetween(-0.5, 0.5),
      moveStart: now,
      moveDuration: this.randomBetween(420, 980),
      holdUntil: now + this.randomBetween(260, 900),
      catMouthStartAt: 0,
      catMouthUntil: 0,
      catMouthNextAt: now + this.randomBetween(3200, 8200),
    };
  }

  private updateIdleLook(now: number): void {
    const look = this.idleLook;
    if (!look) return;
    const moving = now < look.moveStart + look.moveDuration;
    if (!moving && now >= look.holdUntil) {
      const current = this.sampleIdleLook(now);
      look.fromX = current.x;
      look.fromY = current.y;
      look.toX = this.randomBetween(-0.55, 0.55);
      look.toY = this.randomBetween(-0.55, 0.55);
      look.moveStart = now;
      look.moveDuration = this.randomBetween(360, 1100);
      look.holdUntil = now + look.moveDuration + this.randomBetween(220, 1200);
    }
    if (now >= look.catMouthNextAt && now >= look.catMouthUntil) {
      look.catMouthStartAt = now;
      look.catMouthUntil = now + this.randomBetween(4600, 5600);
      look.catMouthNextAt = look.catMouthUntil + this.randomBetween(5200, 11000);
    }
  }

  private sampleIdleLook(now: number): { x: number; y: number } {
    const look = this.idleLook;
    if (!look) return { x: 0, y: 0 };
    const eased = easeInOutSine(clamp01((now - look.moveStart) / look.moveDuration));
    return { x: lerp(look.fromX, look.toX, eased), y: lerp(look.fromY, look.toY, eased) };
  }

  private idleCatMouthBlend(now: number): number {
    const look = this.idleLook;
    if (!look?.catMouthUntil || now >= look.catMouthUntil) return 0;
    const remaining = look.catMouthUntil - now;
    const fadeIn = clamp01((now - (look.catMouthStartAt || now)) / 220);
    const fadeOut = clamp01(remaining / 260);
    return Math.min(fadeIn, fadeOut, 1);
  }

  private applyIdle(target: Record<FaceStateKey, number>, now: number, owned: Set<FaceStateKey>): void {
    if (this.state === 'sleeping') return; // the awake idle yields to the sleeping state bias
    if (this.idleStartedAt < 0 || !this.idleLook) {
      this.idleStartedAt = now;
      this.idleLook = this.createIdleLook(now);
    }
    this.updateIdleLook(now);

    const t = (now - this.idleStartedAt) / 1000;
    const look = this.sampleIdleLook(now);
    const isSpeaking = this.lip !== null;
    const speakingAmount = isSpeaking ? clamp01(this.lip!.open) : 0;
    const speakingMix = isSpeaking ? Math.max(0.35, speakingAmount * 0.9) : 0;
    const motionScale = 1 - speakingMix * 0.46;
    const gazeScale = 1 - speakingMix * 0.58;

    const swayPrimary = Math.sin(t * 1.22);
    const swaySecondary = Math.sin(t * 2.18 + 0.7) * 0.16;
    const sway = swayPrimary + swaySecondary;
    const swaySlow = Math.sin(t * 0.68 + 0.45);
    const swayWide = Math.sin(t * 0.34 + 1.2);
    const bounceSoft = Math.max(0, Math.sin(t * 1.42 + 0.55));
    const bounceTiny = Math.max(0, Math.sin(t * 2.34 + 0.18));
    const drift = Math.sin(t * 0.54 + 0.72);
    const peekSide = Math.sin(t * 0.82 + 0.26);
    const bodyJitter =
      Math.sin(t * 4.8 + 0.3) * 0.9 + Math.sin(t * 7.6 + 1.1) * 0.55 + Math.sin(t * 11.2 + 2.4) * 0.28;
    const bodyRoll = (sway * 8.4 + bodyJitter * 0.9) * motionScale;
    const headRoll = (sway * 40 + bodyJitter * 0.36) * motionScale;
    const bodyYaw =
      (sway * 10.5 + Math.sin(t * 3.3 + 0.4) * 2.4 + Math.sin(t * 6.9 + 1.7) * 1.1) * motionScale;
    const bodyLift =
      (Math.sin(t * 1.12 + 1.2) * 5.2 + Math.sin(t * 4.7 + 0.3) * 2.0 + Math.sin(t * 8.6 + 2.0) * 0.75) *
      motionScale;
    const headYaw = (bodyYaw * 1.85 + Math.sin(t * 0.38 + 0.9) * 0.6 * motionScale) * (1 - speakingMix * 0.24);

    let idle: Pose;
    switch (this.idleProfile) {
      case 'cuteSwayV1':
        idle = {
          headRoll: (sway * 30 + swayWide * 6.8 + bodyJitter * 0.6) * motionScale,
          bodyRoll: (sway * 9.2 + drift * 2.4 + bodyJitter * 0.36) * motionScale,
          headYaw: (look.x * 10.4 + sway * 6.2 + drift * 2.6) * (1 - speakingMix * 0.22),
          bodyYaw: (sway * 6.8 + swayWide * 2.2 + bodyJitter * 0.22) * motionScale,
          headPitch: (-1.8 + bounceSoft * 3.0 + drift * 1.1) * (1 - speakingMix * 0.18),
          bodyLift: (2.8 + bounceSoft * 5.4 + bounceTiny * 2.1) * motionScale,
          bow: 0.15 + bounceSoft * 0.08,
          bowPress: 0.26 + bounceSoft * 0.14,
          gazeX: look.x * 0.68 * gazeScale + sway * 0.08,
          gazeY: (0.07 + Math.abs(drift) * 0.07) * gazeScale,
          browLY: -0.03 + Math.sin(t * 0.66 + 0.18) * 0.02,
          browRY: -0.03 + Math.sin(t * 0.66 + 0.36) * 0.02,
          mouthForm: speakingMix > 0 ? -0.04 : 0.02 + Math.sin(t * 0.58 + 0.3) * 0.04,
          mouthOpen: speakingMix > 0 ? 0 : 0.01 + Math.max(0, Math.sin(t * 0.92 + 0.4)) * 0.02,
          mouthPucker: -0.26 - Math.abs(Math.sin(t * 0.62 + 0.24)) * 0.08,
          mouthShrug: 0.42 + Math.abs(Math.sin(t * 0.74 + 0.52)) * 0.18,
          cheekPuff: 0.06 + Math.max(0, Math.sin(t * 0.54 + 0.22)) * 0.05,
        };
        break;
      case 'peekyIdleV1':
        idle = {
          headRoll: (-peekSide * 7.2 + drift * 1.9 + bodyJitter * 0.24) * motionScale,
          bodyRoll: (-peekSide * 2.9 + drift * 0.78) * motionScale,
          headYaw: (peekSide * 11.8 + look.x * 4.8) * (1 - speakingMix * 0.22),
          bodyYaw: (peekSide * 5.4 + drift * 1.4) * motionScale,
          headPitch: (1.2 + Math.max(0, Math.sin(t * 0.64 + 0.5)) * 1.5) * (1 - speakingMix * 0.16),
          bodyLift: (1.4 + bounceSoft * 2.5) * motionScale,
          bow: 0.07 + bounceSoft * 0.04,
          gazeX: (peekSide * 0.34 + look.x * 0.32) * gazeScale,
          gazeY: (0.06 + Math.abs(Math.sin(t * 1.16 + 0.18)) * 0.08) * gazeScale,
          browLY: 0.05 + Math.max(0, peekSide) * 0.03,
          browRY: -0.04 - Math.max(0, peekSide) * 0.03,
          browLAngle: 0.12 + Math.max(0, peekSide) * 0.06,
          browRAngle: -0.08 - Math.max(0, peekSide) * 0.04,
          mouthForm: 0.08 + Math.sin(t * 0.58 + 0.32) * 0.03,
          mouthOpen: speakingMix > 0 ? 0 : 0.03 + Math.max(0, Math.sin(t * 0.78 + 0.2)) * 0.02,
          jawOpen: speakingMix > 0 ? 0 : 0.02 + Math.max(0, Math.sin(t * 0.86 + 0.35)) * 0.03,
          mouthShift: peekSide * 0.05,
          mouthPucker: -0.18 - Math.abs(Math.sin(t * 0.52 + 0.18)) * 0.05,
          mouthShrug: 0.22 + Math.abs(Math.sin(t * 0.66 + 0.44)) * 0.08,
        };
        break;
      case 'shyDriftV1':
        idle = {
          headRoll: (10.6 + swaySlow * 4.5 + bodyJitter * 0.16) * motionScale,
          bodyRoll: (3.4 + swaySlow * 1.8) * motionScale,
          headYaw: (-2.2 + swaySlow * 4.2 + look.x * 2.6) * (1 - speakingMix * 0.2),
          bodyYaw: (-2.0 + swaySlow * 2.5) * motionScale,
          headPitch: (6.4 + Math.max(0, Math.sin(t * 0.56 + 0.32)) * 2.2) * (1 - speakingMix * 0.16),
          bodyLift: (1.0 + bounceSoft * 2.5) * motionScale,
          bow: 0.1 + bounceSoft * 0.07,
          bowPress: 0.16 + bounceSoft * 0.09,
          gazeX: (-0.1 + look.x * 0.28) * gazeScale,
          gazeY: (0.36 + Math.abs(swaySlow) * 0.1) * gazeScale,
          browLY: 0.08 + Math.sin(t * 0.52 + 0.18) * 0.03,
          browRY: 0.08 + Math.sin(t * 0.52 + 0.36) * 0.03,
          browLForm: -0.16,
          browRForm: -0.16,
          mouthForm: speakingMix > 0 ? -0.04 : 0.14 + Math.sin(t * 0.48 + 0.24) * 0.03,
          mouthOpen: speakingMix > 0 ? 0 : 0.02 + Math.max(0, Math.sin(t * 0.68 + 0.2)) * 0.015,
          mouthPucker: -0.18 - Math.abs(Math.sin(t * 0.58 + 0.2)) * 0.04,
          mouthShrug: 0.28 + Math.abs(Math.sin(t * 0.52 + 0.42)) * 0.08,
          cheekPuff: 0.05 + Math.max(0, Math.sin(t * 0.42 + 0.2)) * 0.03,
        };
        break;
      case 'sweetBounceV1':
        idle = {
          headRoll: (sway * 17.8 + bounceTiny * 3.4 + bodyJitter * 0.35) * motionScale,
          bodyRoll: (sway * 5.1 + drift * 1.0) * motionScale,
          headYaw: (sway * 5.4 + look.x * 4.5) * (1 - speakingMix * 0.2),
          bodyYaw: (sway * 4.8 + drift * 1.3) * motionScale,
          headPitch: (-1.0 + bounceSoft * 2.8) * (1 - speakingMix * 0.16),
          bodyLift: (3.2 + bounceSoft * 6.3 + bounceTiny * 2.4) * motionScale,
          bow: 0.07 + bounceSoft * 0.04,
          gazeX: look.x * 0.5 * gazeScale + sway * 0.06,
          gazeY: (0.04 + Math.abs(Math.sin(t * 1.18 + 0.14)) * 0.06) * gazeScale,
          mouthForm: speakingMix > 0 ? -0.02 : 0.08 + Math.sin(t * 0.74 + 0.2) * 0.04,
          mouthOpen: speakingMix > 0 ? 0 : 0.03 + bounceSoft * 0.04,
          jawOpen: speakingMix > 0 ? 0 : 0.02 + bounceSoft * 0.03,
          mouthPucker: -0.1 - Math.abs(Math.sin(t * 0.6 + 0.16)) * 0.03,
          mouthShrug: 0.22 + Math.abs(Math.sin(t * 0.68 + 0.42)) * 0.08,
          cheekPuff: 0.04 + bounceTiny * 0.03,
        };
        break;
      default: // defaultIdleV1
        idle = {
          headRoll,
          bodyRoll,
          headYaw,
          bodyYaw,
          headPitch: (Math.sin(t * 0.82 + 2.1) * 4.5 + bodyLift * 0.6) * (1 - speakingMix * 0.24),
          bodyLift,
          gazeX: look.x * gazeScale,
          gazeY: look.y * gazeScale,
          mouthForm:
            speakingMix > 0
              ? -0.12
              : -0.08 + Math.sin(t * 0.52 + 0.4) * 0.14 + Math.sin(t * 0.19 + 1.3) * 0.08,
          mouthOpen:
            speakingMix > 0
              ? 0
              : Math.max(0, Math.sin(t * 0.74 + 1.1)) * 0.08 + Math.max(0, Math.sin(t * 0.27 + 2.0)) * 0.045,
        };
        break;
    }

    if (!isSpeaking && CAT_ACCENT_IDLE.has(this.idleProfile)) {
      const catBlend = this.idleCatMouthBlend(now);
      if (catBlend > 0) {
        idle.mouthOpen = lerp(idle.mouthOpen ?? 0, 0, catBlend);
        idle.mouthForm = lerp(idle.mouthForm ?? 0, -0.1, catBlend);
        idle.mouthPucker = lerp(0, -0.5, catBlend);
        idle.mouthShrug = lerp(0, 1.5, catBlend);
        idle.cheekPuff = lerp(0, 0.8, catBlend);
      }
    }

    for (const key of Object.keys(idle) as FaceStateKey[]) {
      if (owned.has(key)) continue; // an active emotion owns these
      if (IDLE_EYE_SKIP.has(key)) continue; // leave the eyes to the built-in blink
      if (this.gazeActive && GAZE_KEYS.has(key)) continue; // mouse gaze-follow owns the eyes
      if (isSpeaking && MOUTH_CHANNEL.has(key)) continue; // lip-sync owns the mouth
      const v = idle[key];
      if (v !== undefined) target[key] = v;
    }
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
