import { getMemoryDb } from '../memory/sessionStore';
import { effectiveCadence } from './style';
import type { ProactiveScenario } from './ladder';

// The cadence governor (Initiative 5, v0.10.2). The mechanical rail around the
// wake judgment: quotas, cooldowns, quiet hours, deep-absence — the cheap
// prefilter that short-circuits the obvious "don't wake" cases for free, before
// any LLM judgment spends a token (Initiative-4 cheap-exit discipline). The
// Python 5-state machine survives only as these cadence fields, not as a
// message-only behavior switch (LD #15).

export type ProactivePhase = 'engaged' | 'idle_watch' | 'nudged' | 'dormant' | 'sleeping';

export type Cadence = {
  phase: ProactivePhase;
  quotaUsed: number;
  quotaDate: string; // YYYY-MM-DD (UTC); quota resets when this rolls over
  lastProactiveMs: number; // 0 = never fired
  nudgesSent: number;
};

const DEFAULT_CADENCE: Cadence = {
  phase: 'engaged',
  quotaUsed: 0,
  quotaDate: '',
  lastProactiveMs: 0,
  nudgesSent: 0,
};

function num(env: string, fallback: number): number {
  const v = Number(Bun.env[env]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

// Default ON since v0.11.0 (Alan's choice). LUNA_PROACTIVE=0 is the kill switch.
export function proactiveEnabled(): boolean {
  return Bun.env['LUNA_PROACTIVE'] !== '0';
}

// C3 (v0.16.0): the daily quota rolls over on the LOCAL date, the same clock as
// quiet-hours (`getHours()`). Previously this used UTC (`toISOString`), so for a
// non-UTC user the "daily" quota reset at a confusing local time. One clock now.
export function dateKey(nowMs: number): string {
  const d = new Date(nowMs);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Local hours in which Luna stays quiet. Default: midnight–6am.
function quietHours(): Set<number> {
  const raw = Bun.env['LUNA_PROACTIVE_QUIET_HOURS'] ?? '0,1,2,3,4,5';
  return new Set(
    raw
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 23),
  );
}

export type WakeContext = { lastUserMs: number; nowMs: number; nowHour: number };

// v0.22.0 (Initiative 15): the anti-spam rail that gates the deterministic detector path —
// quiet hours + a small idle floor + cooldown + daily quota. Deliberately does NOT apply a
// `deep_absence` (>18h) cut or a 10-minute `too_soon` floor: a long overnight/weekend absence is
// exactly when an after-a-night greeting SHOULD fire, so it must not be swallowed (the never-fires
// hole the redesign killed). v0.22.3 deleted the old LLM-gate prefilter (`shouldConsiderWake`),
// which DID apply those cuts, together with the wake-gate it fed.
export function passesAntiSpam(c: Cadence, x: WakeContext): { ok: boolean; reason: string } {
  if (!proactiveEnabled()) return { ok: false, reason: 'disabled' };
  if (quietHours().has(x.nowHour)) return { ok: false, reason: 'quiet_hours' };
  // v0.22.1: a small idle floor — don't reach in during a live exchange (an event-hook
  // detector could otherwise fire seconds after the user's last message). Much smaller
  // than the old 10m `too_soon` gate (which is intentionally NOT here — detectors, not
  // an idle window, decide WHEN to consider).
  const userGap = x.lastUserMs > 0 ? x.nowMs - x.lastUserMs : Infinity;
  if (userGap < num('LUNA_PROACTIVE_IDLE_FLOOR_MS', 60_000)) {
    return { ok: false, reason: 'mid_conversation' };
  }
  // v0.24.2: the cooldown + quota come from the effective cadence (the activeness lever scaled
  // inside the operator floor/ceiling; balanced === the raw knobs, so behaviour is unchanged until
  // Luna moves her activeness via set_proactive_style).
  const eff = effectiveCadence();
  const sinceProactive = c.lastProactiveMs > 0 ? x.nowMs - c.lastProactiveMs : Infinity;
  if (sinceProactive < eff.minIntervalMs) {
    return { ok: false, reason: 'cooldown' };
  }
  if (c.quotaDate === dateKey(x.nowMs) && c.quotaUsed >= eff.dailyQuota) {
    return { ok: false, reason: 'quota_exhausted' };
  }
  return { ok: true, reason: 'ok' };
}

// After a proactive cycle fires: bump the daily quota (rolling over on a new
// day) and stamp the time, for lull anchoring + cooldown next tick. v0.22.0: this
// is the SPOKE commit — only a turn that actually sent a message consumes the daily
// message budget. A silent draft uses commitProactiveSilent (stamp only).
export function commitProactive(c: Cadence, nowMs: number): Cadence {
  const today = dateKey(nowMs);
  const sameDay = c.quotaDate === today;
  return {
    ...c,
    quotaUsed: sameDay ? c.quotaUsed + 1 : 1,
    quotaDate: today,
    lastProactiveMs: nowMs,
  };
}

// v0.22.0 (Initiative 15): a proactive turn that considered but stayed SILENT — stamp
// the cooldown anchor (so it can't re-fire next tick) but do NOT bump the daily quota
// (the budget counts MESSAGES, not considerations). Lets her "consider and stay quiet"
// cheaply without exhausting the 5/day cap.
export function commitProactiveSilent(c: Cadence, nowMs: number): Cadence {
  return { ...c, lastProactiveMs: nowMs };
}

// v0.24.0 (Initiative 17): the ladder's SPOKE commit (port of proactive.py commit_emission
// :322-342). Bumps the daily quota (rolling on a new local day, like commitProactive) + stamps
// the cooldown anchor, then advances the phase per the fired scenario: idle_nudge/renudge →
// nudged (+nudgesSent); leave_message → dormant; ambient stays put. A model-emitted
// follow_up:false forces dormant (a future "this is enough" override; null = keep the mechanical
// phase). A SILENT ladder consideration uses commitProactiveSilent instead — no quota, no phase
// advance (a silent draft doesn't burn a nudge, matching Python's note_attempt).
export function commitScenario(
  c: Cadence,
  scenario: ProactiveScenario,
  nowMs: number,
  followUp: boolean | null = null,
  // The effective phase/nudgesSent the evaluator computed this tick (after user-reset /
  // dormant-recovery / engaged→idle_watch). MUST be advanced from, not from the stale persisted
  // cadence — otherwise a reset's nudgesSent=0 is dropped and she skips the whole renudge tier.
  effective?: { phase: ProactivePhase; nudgesSent: number },
): Cadence {
  const today = dateKey(nowMs);
  const sameDay = c.quotaDate === today;
  const baseNudges = effective?.nudgesSent ?? c.nudgesSent;
  let phase: ProactivePhase = effective?.phase ?? c.phase;
  let nudgesSent = baseNudges;
  if (scenario === 'idle_nudge' || scenario === 'renudge') {
    nudgesSent = baseNudges + 1;
    phase = 'nudged';
  } else if (scenario === 'leave_message') {
    phase = 'dormant';
  }
  // ambient stays in its (effective) phase.
  if (followUp === false) phase = 'dormant';
  return {
    ...c,
    quotaUsed: sameDay ? c.quotaUsed + 1 : 1,
    quotaDate: today,
    lastProactiveMs: nowMs,
    phase,
    nudgesSent,
  };
}

// v0.24.0 (Initiative 17): a ladder scenario was offered but the model stayed silent
// (drafting-as-decision). Stamp the cooldown anchor (a real consideration happened) + persist the
// evaluator's phase transition so a dormant→engaged recovery or engaged→idle_watch survives — but do
// NOT bump the quota or consume a nudge (Python note_attempt :344-347 leaves nudges_sent untouched).
export function commitLadderSilent(
  c: Cadence,
  phase: ProactivePhase,
  nudgesSent: number,
  nowMs: number,
): Cadence {
  return { ...c, lastProactiveMs: nowMs, phase, nudgesSent };
}

// v0.24.0: the ladder computed a phase transition (reset / recovery / engaged→idle_watch / sleeping)
// but nothing fired this tick. Persist ONLY the phase/nudges — NEVER touch lastProactiveMs, or the
// recovery/idle clock would re-arm every tick and never elapse (the DORMANT-lockout bug).
export function commitLadderPhase(c: Cadence, phase: ProactivePhase, nudgesSent: number): Cadence {
  return { ...c, phase, nudgesSent };
}

// User spoke → reset the cadence to engaged (Python: any user message resets phase + nudges).
// v0.24.0+ the ladder also derives this read-time (lastUserMs > lastProactiveMs), so this stays a
// utility; the scheduled-slot machinery (v0.22.1) was deleted with the detector registry in v0.24.1.
export function recordUserActivity(c: Cadence): Cadence {
  return { ...c, phase: 'engaged', nudgesSent: 0 };
}

// The `proactive_slots_used`/`proactive_slots_date` columns (migration 0013) are left in the schema
// as vestigial (both NOT NULL DEFAULT), but no longer read or written since v0.24.1.
type Row = {
  proactive_phase: string;
  proactive_quota_used: number;
  proactive_quota_date: string;
  proactive_last_ms: number;
  proactive_nudges: number;
};

const PHASES: ReadonlySet<string> = new Set([
  'engaged',
  'idle_watch',
  'nudged',
  'dormant',
  'sleeping',
]);

export function loadCadence(sessionId: string): Cadence {
  const db = getMemoryDb();
  if (!db) return { ...DEFAULT_CADENCE };
  const row = db
    .prepare(
      'SELECT proactive_phase, proactive_quota_used, proactive_quota_date, proactive_last_ms, proactive_nudges FROM sessions WHERE id = ?',
    )
    .get(sessionId) as Row | null;
  if (!row) return { ...DEFAULT_CADENCE };
  return {
    phase: PHASES.has(row.proactive_phase) ? (row.proactive_phase as ProactivePhase) : 'engaged',
    quotaUsed: row.proactive_quota_used,
    quotaDate: row.proactive_quota_date,
    lastProactiveMs: row.proactive_last_ms,
    nudgesSent: row.proactive_nudges,
  };
}

export function saveCadence(sessionId: string, c: Cadence): void {
  const db = getMemoryDb();
  if (!db) return;
  const changes = db
    .prepare(
      'UPDATE sessions SET proactive_phase=?, proactive_quota_used=?, proactive_quota_date=?, proactive_last_ms=?, proactive_nudges=? WHERE id=?',
    )
    .run(c.phase, c.quotaUsed, c.quotaDate, c.lastProactiveMs, c.nudgesSent, sessionId).changes;
  if (changes === 0) {
    db.prepare(
      'INSERT INTO sessions (id, updated_ms, proactive_phase, proactive_quota_used, proactive_quota_date, proactive_last_ms, proactive_nudges) VALUES (?,?,?,?,?,?,?)',
    ).run(sessionId, Date.now(), c.phase, c.quotaUsed, c.quotaDate, c.lastProactiveMs, c.nudgesSent);
  }
}
