import { getMemoryDb } from '../memory/sessionStore';

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

export function dateKey(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
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

// Pure cheap-exit prefilter: returns whether the (expensive) wake judgment
// should run at all. Lull anchoring counts Luna's OWN last proactive message
// toward the silence measurement so she can't nudge into a lull she just broke.
export function shouldConsiderWake(c: Cadence, x: WakeContext): { consider: boolean; reason: string } {
  if (!proactiveEnabled()) return { consider: false, reason: 'disabled' };
  if (quietHours().has(x.nowHour)) return { consider: false, reason: 'quiet_hours' };

  const userGap = x.lastUserMs > 0 ? x.nowMs - x.lastUserMs : Infinity;
  if (userGap > num('LUNA_PROACTIVE_LONG_ABSENCE_MS', 64_800_000)) {
    return { consider: false, reason: 'deep_absence' }; // > ~18h → don't wake her world
  }

  const sinceProactive = c.lastProactiveMs > 0 ? x.nowMs - c.lastProactiveMs : Infinity;
  if (sinceProactive < num('LUNA_PROACTIVE_MIN_INTERVAL_MS', 300_000)) {
    return { consider: false, reason: 'cooldown' };
  }

  if (c.quotaDate === dateKey(x.nowMs) && c.quotaUsed >= num('LUNA_PROACTIVE_DAILY_QUOTA', 5)) {
    return { consider: false, reason: 'quota_exhausted' };
  }

  const effectiveGap = Math.min(userGap, sinceProactive);
  if (effectiveGap < num('LUNA_PROACTIVE_IDLE_THRESHOLD_MS', 600_000)) {
    return { consider: false, reason: 'too_soon' };
  }

  return { consider: true, reason: 'idle' };
}

// After a proactive cycle fires: bump the daily quota (rolling over on a new
// day) and stamp the time, for lull anchoring + cooldown next tick.
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

// User spoke → reset the cadence to engaged (Python: any user message resets
// phase + nudges).
export function recordUserActivity(c: Cadence): Cadence {
  return { ...c, phase: 'engaged', nudgesSent: 0 };
}

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
