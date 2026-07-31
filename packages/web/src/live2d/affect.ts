import type { ExpressionKey } from '@luna/protocol';
import { clamp01, lerp } from './ease';

// The continuous affect core (Initiative 29, v0.42.0).
//
// Until now the face was told how to feel by an EVENT: `setExpression` picked one of 14 hand-authored
// clips, played a ~7-8 s intro→perform→outro, then returned to exact baseline with zero residue. Two
// messages in a row produced two identical performances with nothing carried between them — that is
// the "stiffness".
//
// This module is the missing STATE. Affects arrive as impulses into a 3-axis VAD field that keeps
// evolving between messages, so "back to rest" means "back to her current mood" rather than "back to
// zero". The two-timescale design (a fast `current` chasing a slow-decaying `target`) is adapted from
// soullink-emotion-sdk's EmotionStateController (MIT, nanlingyin/soullink-emotion-sdk) — the ideas,
// re-derived against Luna's own 15 affects; no dependency is taken (see the initiative README for why).
//
// Deliberately ignorant of face channels: nothing here imports paramMap/faceData, so the same state
// can later drive non-face things (voice pacing, proactive tone) without a circular dependency.

export type Vad = { valence: number; arousal: number; dominance: number };

export type AffectOptions = {
  approachRate?: number; // current → target, per second (τ ≈ 0.74 s at the default)
  decayRate?: number; // target → baseline, per second (half-life ≈ 38 s at the default)
  holdSeconds?: number; // intensity-scaled hold ON TOP of a 6 s floor
  reactivity?: number; // global impulse gain — 0 makes her affectively flat
  baseline?: Vad; // her resting temperament; decay pulls here, not to zero
};

// Dead neutral, deliberately. A non-zero resting temperament is the whole subject of v0.42.2 (the
// living baseline); shipping it here would mean enabling the layer visibly changes a face that is
// doing nothing, which would cost the "turning this on is provably safe" guarantee that lets the
// undertone be verified in isolation. `setBaseline` already exists for when that version arrives.
export const DEFAULT_BASELINE: Vad = { valence: 0, arousal: 0, dominance: 0 };

const DEFAULTS = {
  approachRate: 1.35,
  decayRate: 0.018,
  holdSeconds: 9,
  reactivity: 1,
} as const;

// A tab that was backgrounded for ten minutes must not teleport her mood on the frame it regains
// focus, so the per-tick advance is capped regardless of wall-clock gap.
const MAX_DT_SECONDS = 0.25;
const HOLD_FLOOR_SECONDS = 6;

// All 15 affects as VAD coordinates — no fan-in. The existing AFFECT_TO_EMOTION collapses these to 11
// clips (three of them land on `tender` alone); that lookup still governs the CLIP layer, but the
// continuous layer reads this table instead, so distinctions the wire already carries survive.
export const AFFECT_VAD: Record<ExpressionKey, Vad> = {
  steady_presence: { valence: 0.05, arousal: -0.1, dominance: 0.05 },
  soft_warmth: { valence: 0.55, arousal: -0.15, dominance: 0.0 },
  gentle_concern: { valence: -0.1, arousal: -0.05, dominance: -0.15 },
  open_reengagement: { valence: 0.4, arousal: 0.15, dominance: 0.05 },
  curious_attention: { valence: 0.25, arousal: 0.35, dominance: 0.0 },
  listening_attention: { valence: 0.15, arousal: 0.05, dominance: -0.1 },
  focused_engagement: { valence: 0.1, arousal: 0.3, dominance: 0.25 },
  playful_brightness: { valence: 0.65, arousal: 0.45, dominance: 0.2 },
  bright_delight: { valence: 0.85, arousal: 0.55, dominance: 0.1 },
  alert_surprise: { valence: 0.1, arousal: 0.75, dominance: -0.1 },
  amused_smirk: { valence: 0.45, arousal: 0.2, dominance: 0.45 },
  shy_softness: { valence: 0.3, arousal: -0.05, dominance: -0.45 },
  awkward_lightness: { valence: -0.05, arousal: 0.25, dominance: -0.35 },
  guarded_distance: { valence: -0.3, arousal: -0.1, dominance: 0.2 },
  annoyed_resistance: { valence: -0.55, arousal: 0.4, dominance: 0.35 },
};

const AXES = ['valence', 'arousal', 'dominance'] as const;

function clampAxis(v: number): number {
  return Math.max(-1, Math.min(1, v));
}

function copy(v: Vad): Vad {
  return { valence: v.valence, arousal: v.arousal, dominance: v.dominance };
}

function lerpVad(a: Vad, b: Vad, t: number): Vad {
  return {
    valence: clampAxis(lerp(a.valence, b.valence, t)),
    arousal: clampAxis(lerp(a.arousal, b.arousal, t)),
    dominance: clampAxis(lerp(a.dominance, b.dominance, t)),
  };
}

export class AffectState {
  private readonly approachRate: number;
  private readonly decayRate: number;
  private readonly holdSeconds: number;
  private readonly reactivity: number;
  private base: Vad;

  private cur: Vad;
  private target: Vad;
  private holdRemaining = 0;
  private last = -1; // <0 = initialise the clock on the next tick (dt 0, no jump)

  constructor(opts: AffectOptions = {}) {
    this.approachRate = opts.approachRate ?? DEFAULTS.approachRate;
    this.decayRate = opts.decayRate ?? DEFAULTS.decayRate;
    this.holdSeconds = opts.holdSeconds ?? DEFAULTS.holdSeconds;
    this.reactivity = opts.reactivity ?? DEFAULTS.reactivity;
    this.base = copy(opts.baseline ?? DEFAULT_BASELINE);
    this.cur = copy(this.base);
    this.target = copy(this.base);
  }

  // An affect never SETS the state — it perturbs the target, which is what makes two messages with
  // the same affect land differently depending on where she already was.
  nudge(key: ExpressionKey, intensity = 0.95): void {
    const i = clamp01(intensity);
    const amount = Math.max(0, Math.min(0.96, (0.28 + i * 0.58) * this.reactivity));
    this.target = lerpVad(this.target, AFFECT_VAD[key], amount);
    this.holdRemaining = Math.max(this.holdRemaining, HOLD_FLOOR_SECONDS + i * this.holdSeconds);
  }

  // Same millisecond clock FaceVm ticks on, so the mood and the face share one timeline.
  tick(now: number): void {
    if (this.last < 0) {
      this.last = now;
      return;
    }
    const dt = Math.max(0, Math.min(MAX_DT_SECONDS, (now - this.last) / 1000));
    this.last = now;
    if (dt === 0) return;

    // Frame-rate independent exponential approach: the same wall-clock produces the same motion at
    // 30 fps and 144 fps.
    const approach = 1 - Math.exp(-dt * this.approachRate);
    this.cur = lerpVad(this.cur, this.target, approach);

    // The hold is what makes a mood *stick* right after it lands, instead of starting to fade the
    // instant it arrives.
    if (this.holdRemaining > 0) {
      this.holdRemaining = Math.max(0, this.holdRemaining - dt);
    } else {
      this.target = lerpVad(this.target, this.base, 1 - Math.exp(-dt * this.decayRate));
    }
  }

  get current(): Readonly<Vad> {
    return this.cur;
  }

  // Exposed for tests and for v0.42.2's living baseline; the target chases this, not zero.
  get baseline(): Readonly<Vad> {
    return this.base;
  }

  setBaseline(v: Partial<Vad>): void {
    this.base = {
      valence: clampAxis(v.valence ?? this.base.valence),
      arousal: clampAxis(v.arousal ?? this.base.arousal),
      dominance: clampAxis(v.dominance ?? this.base.dominance),
    };
  }

  // Hard reset — used when the model is torn down or the session is cleared.
  clear(): void {
    this.cur = copy(this.base);
    this.target = copy(this.base);
    this.holdRemaining = 0;
    this.last = -1;
  }
}

// Exported for tests that need to assert axis-wise properties without hardcoding key names.
export const VAD_AXES = AXES;
