import type { LipSyncFrame } from '../sinks';

// Faithful port of Python js/runtime/lip-sync.js — the full mouth-articulation
// engine, not the energy-only stub it replaces. Per audio frame: RMS → EMA
// contrast/gate (ingest) → on a jittered ~70ms clock, pick a fresh random
// open-target weighted by energy (rest/medium/wide) → asymmetric attack(fast)/
// release(slow) + hard-close → form/pucker/shrug shaped from the open level
// (lookup buckets) + sine micro-motions (tick). Driving all four mouth params with
// stochastic stepping is what makes the mouth read as speech instead of a flat
// amplitude follower (the "ugly" single-param TS version). Pure (no Web Audio) so
// it unit-tests; RNG is injectable for deterministic tests.

export type LipSyncOpts = {
  gain?: number;
  smoothing?: number;
  closeSpeed?: number;
  shapeSmoothing?: number;
  floor?: number;
  mouthStepMs?: number;
  mouthStepJitterMs?: number;
  rng?: () => number;
};

export class LipSync {
  private readonly gain: number;
  private readonly smoothing: number;
  private readonly closeSpeed: number;
  private readonly shapeSmoothing: number;
  private readonly floor: number;
  private readonly mouthStepMs: number;
  private readonly mouthStepJitterMs: number;
  private readonly rng: () => number;

  private currentOpen = 0;
  private targetOpen = 0;
  private currentForm = 0.12;
  private targetForm = 0.12;
  private currentShrug = 0;
  private targetShrug = 0;
  private currentPucker = 0.6;
  private targetPucker = 0.6;
  private lastOpen = 0;
  private lastMapped = 0;
  private energyAvg = 0;
  private pendingEnergy = 0;
  private time = 0;
  private mouthClockMs = 0;
  private shapePhase: number;
  private currentStepDurationMs: number;

  constructor(opts: LipSyncOpts = {}) {
    // Defaults run a touch calmer than the Python original (smoothing 0.26 /
    // closeSpeed 0.58 / step 70ms) — per real-use feedback the mouth changed too
    // fast. Slower target stepping + gentler attack/release lowers the visible
    // change rate without going mushy. Override via opts for fine-tuning.
    this.gain = opts.gain ?? 32;
    this.smoothing = opts.smoothing ?? 0.34;
    this.closeSpeed = opts.closeSpeed ?? 0.46;
    this.shapeSmoothing = opts.shapeSmoothing ?? 0.38;
    this.floor = opts.floor ?? 0.02;
    this.mouthStepMs = opts.mouthStepMs ?? 100;
    this.mouthStepJitterMs = opts.mouthStepJitterMs ?? 22;
    this.rng = opts.rng ?? Math.random;
    this.shapePhase = this.rng() * Math.PI * 2;
    this.currentStepDurationMs = this.nextStepMs();
  }

  // Stage 1 — energy analysis (parity with the original ingestRms).
  ingest(rms: number): void {
    const mapped = clamp01(rms * this.gain);
    this.energyAvg += (mapped - this.energyAvg) * 0.08;
    const pulse = Math.max(0, mapped - this.energyAvg * 0.92);
    const onset = Math.max(0, mapped - this.lastMapped);
    const contrasted = pulse * 4.8 + onset * 3.2 + mapped * 0.12;
    const gated = contrasted < this.floor ? 0 : Math.min(1, contrasted);
    this.pendingEnergy = Math.max(this.pendingEnergy * 0.82, gated);
    this.lastMapped = mapped;
  }

  // Stages 2-4 — stochastic stepping + asymmetric smoothing + articulation.
  tick(dtSeconds: number): LipSyncFrame {
    this.time += dtSeconds;
    this.mouthClockMs += dtSeconds * 1000;
    while (this.mouthClockMs >= this.currentStepDurationMs) {
      this.stepOpenTarget();
      this.mouthClockMs -= this.currentStepDurationMs;
      this.currentStepDurationMs = this.nextStepMs();
    }

    const alpha = this.targetOpen > this.currentOpen ? 1 - this.smoothing : this.closeSpeed;
    this.currentOpen += (this.targetOpen - this.currentOpen) * alpha;
    if (this.targetOpen < 0.2 && this.currentOpen < 0.36) this.currentOpen = Math.max(0, this.currentOpen * 0.58);
    if (Math.abs(this.currentOpen) < 0.001 && this.targetOpen < 0.2) this.currentOpen = 0;

    const openingVelocity = this.currentOpen - this.lastOpen;
    const speakingMotion = Math.sin(this.time * 15.5 + this.shapePhase) * 0.055 * Math.min(1, this.currentOpen * 1.45);
    const articulationBias = clamp(openingVelocity * 1.45, -0.05, 0.05);
    const baseForm = computeBaseForm(this.currentOpen);
    const baseShrug = computeBaseShrug(this.currentOpen);
    const basePucker = computeBasePucker(this.currentOpen);
    const convergenceMotion = Math.sin(this.time * 11.2 + this.shapePhase * 0.7) * 0.05 * Math.min(1, this.currentOpen * 1.2);
    const convergenceBias = clamp(openingVelocity * 0.8 + this.pendingEnergy * 0.36, -0.22, 0.22);
    const puckerLead = Math.max(0, this.currentPucker) * 0.22;

    this.targetPucker = clamp(basePucker - articulationBias * 0.45 - speakingMotion * 0.22 + convergenceBias * 1.2, -1.0, 0.5);
    this.targetForm = clamp(baseForm + articulationBias * 0.3 + speakingMotion * 0.35 - puckerLead * 0.55, 0.06, 0.48);
    this.targetShrug = clamp(baseShrug + convergenceBias * 0.45 + convergenceMotion * 0.55, -0.04, 0.4);

    this.currentForm += (this.targetForm - this.currentForm) * this.shapeSmoothing;
    this.currentShrug += (this.targetShrug - this.currentShrug) * this.shapeSmoothing;
    this.currentPucker += (this.targetPucker - this.currentPucker) * this.shapeSmoothing;

    this.lastOpen = this.currentOpen;
    return { open: this.currentOpen, form: this.currentForm, shrug: this.currentShrug, pucker: this.currentPucker };
  }

  reset(): void {
    this.currentOpen = 0;
    this.targetOpen = 0;
    this.currentForm = 0.12;
    this.targetForm = 0.12;
    this.currentShrug = 0;
    this.targetShrug = 0;
    this.currentPucker = 0.6;
    this.targetPucker = 0.6;
    this.lastOpen = 0;
    this.lastMapped = 0;
    this.energyAvg = 0;
    this.pendingEnergy = 0;
    this.time = 0;
    this.mouthClockMs = 0;
    this.currentStepDurationMs = this.nextStepMs();
  }

  private nextStepMs(): number {
    const jitter = (this.rng() * 2 - 1) * this.mouthStepJitterMs;
    return Math.max(16, this.mouthStepMs + jitter);
  }

  private between(min: number, max: number): number {
    return min + this.rng() * (max - min);
  }

  private stepOpenTarget(): void {
    const openStrength = clamp01(this.pendingEnergy);
    const restBias = Math.max(0.08, 0.52 - openStrength * 0.38);
    const mediumBias = 0.24 + openStrength * 0.18;
    const wideBias = 0.08 + openStrength * 0.34;
    const roll = this.rng() * (restBias + mediumBias + wideBias);
    if (roll < restBias) {
      this.targetOpen = this.between(0, 0.22 + openStrength * 0.12);
      this.pendingEnergy *= 0.72;
      return;
    }
    if (roll < restBias + mediumBias) {
      this.targetOpen = this.between(0.22 + openStrength * 0.18, 0.46 + openStrength * 0.26);
      this.pendingEnergy *= 0.84;
      return;
    }
    this.targetOpen = this.between(Math.min(0.56 + openStrength * 0.18, 0.94), Math.min(0.82 + openStrength * 0.18, 1.0));
    this.pendingEnergy *= 0.9;
  }
}

// Mouth-shape lookup tables (open level → base form/pucker/shrug), verbatim from
// the Python computeBase* step functions.
function computeBaseForm(open: number): number {
  if (open < 0.16) return 0.12;
  if (open < 0.42) return 0.2;
  if (open < 0.72) return 0.28;
  if (open < 0.9) return 0.34;
  return 0.4;
}
function computeBasePucker(open: number): number {
  if (open < 0.14) return 0.48;
  if (open < 0.3) return 0.32;
  if (open < 0.5) return 0.08;
  if (open < 0.7) return -0.26;
  if (open < 0.86) return -0.62;
  return -0.94;
}
function computeBaseShrug(open: number): number {
  if (open < 0.14) return 0.04;
  if (open < 0.42) return 0.12;
  if (open < 0.72) return 0.2;
  return 0.28;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
