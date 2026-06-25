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
  // v0.22.1 (Initiative 15): per-day scheduled-slot bitmask — bit `h` = the slot for
  // local hour h already fired today; reset when slotsDate rolls over.
  slotsUsed: number;
  slotsDate: string;
};

const DEFAULT_CADENCE: Cadence = {
  phase: 'engaged',
  quotaUsed: 0,
  quotaDate: '',
  lastProactiveMs: 0,
  nudgesSent: 0,
  slotsUsed: 0,
  slotsDate: '',
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

// Pure cheap-exit prefilter: returns whether the (expensive) wake judgment
// should run at all. Lull anchoring counts Luna's OWN last proactive message
// toward the silence measurement so she can't nudge into a lull she just broke.
export function shouldConsiderWake(
  c: Cadence,
  x: WakeContext,
): { consider: boolean; reason: string } {
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

// v0.22.0 (Initiative 15): the anti-spam SUBSET used to gate the deterministic
// detector path — quiet hours + cooldown + daily quota ONLY. Deliberately omits
// `deep_absence` (>18h) and the `too_soon` (<10m) idle floor that `shouldConsiderWake`
// applies: a long overnight/weekend absence is exactly when an after-a-night greeting
// SHOULD fire, so it must not be swallowed (the never-fires hole the redesign kills).
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
  const sinceProactive = c.lastProactiveMs > 0 ? x.nowMs - c.lastProactiveMs : Infinity;
  if (sinceProactive < num('LUNA_PROACTIVE_MIN_INTERVAL_MS', 300_000)) {
    return { ok: false, reason: 'cooldown' };
  }
  if (c.quotaDate === dateKey(x.nowMs) && c.quotaUsed >= num('LUNA_PROACTIVE_DAILY_QUOTA', 5)) {
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

// v0.22.1 (Initiative 15): the configured local hours for the scheduledWindow detector
// (LUNA_PROACTIVE_SLOTS, e.g. '11,20'). Unset/empty → no scheduled floor.
export function scheduledSlots(): number[] {
  const raw = (Bun.env['LUNA_PROACTIVE_SLOTS'] ?? '').trim();
  if (raw === '') return []; // unset/empty = no scheduled floor (NOT hour 0)
  return raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 23);
}

// Has the slot for `hour` already fired today? (bit `hour` of the per-day mask)
export function isSlotConsumed(c: Cadence, hour: number, nowMs: number): boolean {
  return c.slotsDate === dateKey(nowMs) && (c.slotsUsed & (1 << hour)) !== 0;
}

// Mark `hour`'s slot fired for today (rolling the mask over on a new local day).
export function markSlotConsumed(c: Cadence, hour: number, nowMs: number): Cadence {
  const today = dateKey(nowMs);
  const sameDay = c.slotsDate === today;
  return { ...c, slotsDate: today, slotsUsed: (sameDay ? c.slotsUsed : 0) | (1 << hour) };
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
  proactive_slots_used: number;
  proactive_slots_date: string;
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
      'SELECT proactive_phase, proactive_quota_used, proactive_quota_date, proactive_last_ms, proactive_nudges, proactive_slots_used, proactive_slots_date FROM sessions WHERE id = ?',
    )
    .get(sessionId) as Row | null;
  if (!row) return { ...DEFAULT_CADENCE };
  return {
    phase: PHASES.has(row.proactive_phase) ? (row.proactive_phase as ProactivePhase) : 'engaged',
    quotaUsed: row.proactive_quota_used,
    quotaDate: row.proactive_quota_date,
    lastProactiveMs: row.proactive_last_ms,
    nudgesSent: row.proactive_nudges,
    slotsUsed: row.proactive_slots_used,
    slotsDate: row.proactive_slots_date,
  };
}

export function saveCadence(sessionId: string, c: Cadence): void {
  const db = getMemoryDb();
  if (!db) return;
  const changes = db
    .prepare(
      'UPDATE sessions SET proactive_phase=?, proactive_quota_used=?, proactive_quota_date=?, proactive_last_ms=?, proactive_nudges=?, proactive_slots_used=?, proactive_slots_date=? WHERE id=?',
    )
    .run(
      c.phase,
      c.quotaUsed,
      c.quotaDate,
      c.lastProactiveMs,
      c.nudgesSent,
      c.slotsUsed,
      c.slotsDate,
      sessionId,
    ).changes;
  if (changes === 0) {
    db.prepare(
      'INSERT INTO sessions (id, updated_ms, proactive_phase, proactive_quota_used, proactive_quota_date, proactive_last_ms, proactive_nudges, proactive_slots_used, proactive_slots_date) VALUES (?,?,?,?,?,?,?,?,?)',
    ).run(
      sessionId,
      Date.now(),
      c.phase,
      c.quotaUsed,
      c.quotaDate,
      c.lastProactiveMs,
      c.nudgesSent,
      c.slotsUsed,
      c.slotsDate,
    );
  }
}
