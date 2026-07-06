// The two-layer proactive style (port of Python memory/proactive_config.py). Operator-owned env
// knobs are the mechanical floor/ceiling — the safety kernel. The `activeness` lever scales
// eagerness WITHIN those rails; it can never breach them.
//
// v0.32.4: activeness is now an OWNER setting (`LUNA_PROACTIVE_ACTIVENESS`, surfaced in the
// settings panel), not a Luna-writable self-setting. The `set_proactive_style` tool and its
// `proactive_style` DB table are retired — the intrusiveness knob belongs to the human operator,
// not the model. Voice notes are retired with it.

export type Activeness = 'aloof' | 'balanced' | 'clingy';
export const ACTIVENESS_LEVELS: readonly Activeness[] = ['aloof', 'balanced', 'clingy'];
export type ProactiveStyle = { activeness: Activeness };

const DEFAULT_STYLE: ProactiveStyle = { activeness: 'balanced' };

export function isActiveness(s: string): s is Activeness {
  return s === 'aloof' || s === 'balanced' || s === 'clingy';
}

// How the activeness lever scales cadence (Python `_LEVEL_MULT`): cooldown × prob × quota.
const LEVEL_MULT: Record<Activeness, { cooldown: number; prob: number; quota: number }> = {
  aloof: { cooldown: 1.8, prob: 0.45, quota: 0.4 },
  balanced: { cooldown: 1.0, prob: 1.0, quota: 1.0 },
  clingy: { cooldown: 0.6, prob: 1.35, quota: 1.6 },
};

export type EffectiveCadence = {
  minIntervalMs: number;
  renudgeBaseMs: number;
  dailyQuota: number;
  nudgeProb: number;
  ambientProb: number;
};

function num(env: string, fallback: number): number {
  const v = Number(Bun.env[env]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}
function numFloat(env: string, fallback: number): number {
  const raw = Bun.env[env];
  if (raw === undefined || raw === '') return fallback;
  const v = Number(raw);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}

export function styleEnabled(): boolean {
  return Bun.env['LUNA_PROACTIVE_STYLE'] !== '0';
}

// The safety kernel: apply the activeness lever to the operator base knobs, then clamp inside the
// mechanical floor/ceiling. `balanced` (the default) reproduces the raw base knobs exactly, so the
// ladder/rail behaviour is unchanged until the operator moves activeness.
export function resolveEffectiveCadence(style: ProactiveStyle): EffectiveCadence {
  const m = LEVEL_MULT[style.activeness] ?? LEVEL_MULT.balanced;
  const baseInterval = num('LUNA_PROACTIVE_MIN_INTERVAL_MS', 300_000);
  const floorInterval = num('LUNA_PROACTIVE_MIN_INTERVAL_FLOOR_MS', 120_000);
  const baseRenudge = num('LUNA_PROACTIVE_RENUDGE_BASE_MS', 300_000);
  const baseQuota = num('LUNA_PROACTIVE_DAILY_QUOTA', 5);
  const quotaCeiling = num('LUNA_PROACTIVE_DAILY_QUOTA_CEILING', 6);
  const baseNudgeProb = numFloat('LUNA_PROACTIVE_NUDGE_PROB', 1.0);
  // v0.29.1: 0.12 → 0.06. `engaged` re-rolls this every ~60s tick while in the ambient band, so
  // 0.12 compounded to ~85% over ~15 min of silence; 0.06 keeps a genuine lull comfortably quiet.
  const baseAmbientProb = numFloat('LUNA_PROACTIVE_AMBIENT_PROB', 0.06);
  return {
    minIntervalMs: Math.max(floorInterval, Math.round(baseInterval * m.cooldown)),
    renudgeBaseMs: Math.max(floorInterval, Math.round(baseRenudge * m.cooldown)),
    dailyQuota: Math.max(0, Math.min(quotaCeiling, Math.round(baseQuota * m.quota))),
    nudgeProb: Math.min(1, baseNudgeProb * m.prob),
    ambientProb: Math.min(1, baseAmbientProb * m.prob),
  };
}

// The operator's chosen activeness (settings-panel pin lands in Bun.env at boot via initSettings).
// A missing or corrupt value degrades to balanced — i.e. the raw operator knobs.
export function loadStyle(): ProactiveStyle {
  const raw = Bun.env['LUNA_PROACTIVE_ACTIVENESS'];
  return { activeness: raw && isActiveness(raw) ? raw : 'balanced' };
}

// The scaled cadence in effect right now (balanced — i.e. the raw knobs — when the style layer is
// off via LUNA_PROACTIVE_STYLE=0).
export function effectiveCadence(): EffectiveCadence {
  return resolveEffectiveCadence(styleEnabled() ? loadStyle() : DEFAULT_STYLE);
}
