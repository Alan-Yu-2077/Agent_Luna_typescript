import { getMemoryDb } from '../memory/sessionStore';

// v0.24.2 (Initiative 17 close): the two-layer proactive style (port of Python
// memory/proactive_config.py). Operator-owned env knobs are the mechanical floor/ceiling — the
// safety kernel. Luna's self-writable style (activeness + voice notes, via set_proactive_style)
// scales her eagerness WITHIN those rails; she can never breach them.

export type Activeness = 'aloof' | 'balanced' | 'clingy';
export const ACTIVENESS_LEVELS: readonly Activeness[] = ['aloof', 'balanced', 'clingy'];
export type ProactiveStyle = { activeness: Activeness; voiceNotes: string };

const DEFAULT_STYLE: ProactiveStyle = { activeness: 'balanced', voiceNotes: '' };

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
// ladder/rail behaviour is unchanged until Luna moves her activeness.
export function resolveEffectiveCadence(style: ProactiveStyle): EffectiveCadence {
  const m = LEVEL_MULT[style.activeness] ?? LEVEL_MULT.balanced;
  const baseInterval = num('LUNA_PROACTIVE_MIN_INTERVAL_MS', 300_000);
  const floorInterval = num('LUNA_PROACTIVE_MIN_INTERVAL_FLOOR_MS', 120_000);
  const baseRenudge = num('LUNA_PROACTIVE_RENUDGE_BASE_MS', 300_000);
  const baseQuota = num('LUNA_PROACTIVE_DAILY_QUOTA', 5);
  const quotaCeiling = num('LUNA_PROACTIVE_DAILY_QUOTA_CEILING', 6);
  const baseNudgeProb = numFloat('LUNA_PROACTIVE_NUDGE_PROB', 1.0);
  const baseAmbientProb = numFloat('LUNA_PROACTIVE_AMBIENT_PROB', 0.12);
  return {
    minIntervalMs: Math.max(floorInterval, Math.round(baseInterval * m.cooldown)),
    renudgeBaseMs: Math.max(floorInterval, Math.round(baseRenudge * m.cooldown)),
    dailyQuota: Math.max(0, Math.min(quotaCeiling, Math.round(baseQuota * m.quota))),
    nudgeProb: Math.min(1, baseNudgeProb * m.prob),
    ambientProb: Math.min(1, baseAmbientProb * m.prob),
  };
}

type StyleRow = { activeness: string; voice_notes: string };

export function loadStyle(): ProactiveStyle {
  const db = getMemoryDb();
  if (!db) return { ...DEFAULT_STYLE };
  const row = db
    .prepare('SELECT activeness, voice_notes FROM proactive_style WHERE id = 1')
    .get() as StyleRow | null;
  if (!row) return { ...DEFAULT_STYLE };
  return {
    activeness: isActiveness(row.activeness) ? row.activeness : 'balanced',
    voiceNotes: row.voice_notes ?? '',
  };
}

export function saveStyle(patch: Partial<ProactiveStyle>): ProactiveStyle {
  const current = loadStyle();
  const next: ProactiveStyle = {
    activeness:
      patch.activeness && isActiveness(patch.activeness) ? patch.activeness : current.activeness,
    voiceNotes: typeof patch.voiceNotes === 'string' ? patch.voiceNotes.trim() : current.voiceNotes,
  };
  const db = getMemoryDb();
  if (db) {
    db.prepare(
      'INSERT INTO proactive_style (id, activeness, voice_notes) VALUES (1, ?, ?) ' +
        'ON CONFLICT(id) DO UPDATE SET activeness = excluded.activeness, voice_notes = excluded.voice_notes',
    ).run(next.activeness, next.voiceNotes);
  }
  return next;
}

// The scaled cadence in effect right now (balanced — i.e. the raw knobs — when the style layer is
// off via LUNA_PROACTIVE_STYLE=0).
export function effectiveCadence(): EffectiveCadence {
  return resolveEffectiveCadence(styleEnabled() ? loadStyle() : DEFAULT_STYLE);
}
