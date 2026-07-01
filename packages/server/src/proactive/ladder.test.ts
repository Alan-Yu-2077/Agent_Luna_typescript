import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import { migrate } from '../sql';
import { setMemoryDb } from '../memory/sessionStore';
import { getSession, resetSessions, type Session } from '../turn/session';
import { type Cadence, commitScenario } from './cadence';
import { evaluateLadder } from './ladder';

const NOW = 1_700_000_000_000;

// Cleared so the ladder runs on its documented defaults regardless of the dev .env.
const LADDER_KNOBS = [
  'LUNA_PROACTIVE_IDLE_THRESHOLD_MS',
  'LUNA_PROACTIVE_AMBIENT_MIN_MS',
  'LUNA_PROACTIVE_AMBIENT_PROB',
  'LUNA_PROACTIVE_NUDGE_PROB',
  'LUNA_PROACTIVE_RENUDGE_BASE_MS',
  'LUNA_PROACTIVE_MAX_NUDGES',
  'LUNA_PROACTIVE_DORMANT_RECOVERY_MS',
  'LUNA_PROACTIVE_LONG_ABSENCE_MS',
];

const baseCadence: Cadence = {
  phase: 'engaged',
  quotaUsed: 0,
  quotaDate: '',
  lastProactiveMs: 0,
  nudgesSent: 0,
  slotsUsed: 0,
  slotsDate: '',
};

let db: Database;
beforeEach(() => {
  db = new Database(':memory:', { strict: true });
  migrate(db, join(import.meta.dir, '..', 'migrations'));
  setMemoryDb(db);
  resetSessions();
  for (const k of LADDER_KNOBS) delete Bun.env[k];
});
afterEach(() => {
  setMemoryDb(null);
  db.close(false);
});

const always = (v: number) => (): number => v;

function sess(lastUserMs: number): Session {
  const s = getSession('default');
  s.lastUserMs = lastUserMs;
  return s;
}

function decide(cad: Partial<Cadence>, lastUserMs: number, rng = always(0)): ReturnType<typeof evaluateLadder> {
  return evaluateLadder(
    { session: sess(lastUserMs), cadence: { ...baseCadence, ...cad }, nowMs: NOW, nowHour: 14 },
    rng,
  );
}
function ladder(cad: Partial<Cadence>, lastUserMs: number, rng = always(0)): string | null {
  return decide(cad, lastUserMs, rng).scenario;
}

describe('evaluateLadder (silence phase machine, v0.24.0)', () => {
  test('engaged + gap ≥ idle_threshold → idle_nudge', () => {
    expect(ladder({}, NOW - 700_000)).toBe('idle_nudge'); // 11.6m > 10m default
  });

  test('engaged + ambient band + rng<prob → ambient; rng≥prob → null', () => {
    expect(ladder({}, NOW - 180_000, always(0))).toBe('ambient'); // 3m, the 12% roll hits
    expect(ladder({}, NOW - 180_000, always(0.99))).toBeNull(); // roll misses
  });

  test('effective_gap = min(userGap, sinceProactive): a recent self-outreach suppresses a nudge', () => {
    // user quiet 11m (would idle_nudge) but she spoke 60s ago → effective gap 60s → null
    expect(ladder({ lastProactiveMs: NOW - 60_000 }, NOW - 700_000)).toBeNull();
  });

  test('nudged: within backoff → null; past it (nudges<max) → renudge', () => {
    // nudgesSent 1 → renudgeGap = 300k × 1.0 = 300k
    expect(
      ladder({ phase: 'nudged', nudgesSent: 1, lastProactiveMs: NOW - 100_000 }, NOW - 2_000_000),
    ).toBeNull();
    expect(
      ladder({ phase: 'nudged', nudgesSent: 1, lastProactiveMs: NOW - 400_000 }, NOW - 2_000_000),
    ).toBe('renudge');
  });

  test('nudged at max_nudges (past backoff) → leave_message', () => {
    // nudgesSent 3 → renudgeGap = 300k × 6.0 = 1.8M
    expect(
      ladder({ phase: 'nudged', nudgesSent: 3, lastProactiveMs: NOW - 2_000_000 }, NOW - 3_000_000),
    ).toBe('leave_message');
  });

  test('dormant recovers after the cool-down, stays quiet before it', () => {
    expect(ladder({ phase: 'dormant', lastProactiveMs: NOW - 1_000_000 }, NOW - 2_000_000)).toBeNull(); // <1h
    expect(ladder({ phase: 'dormant', lastProactiveMs: NOW - 4_000_000 }, NOW - 5_000_000)).toBe(
      'idle_nudge', // ≥1h → recovers to engaged → gap ≥ idle_threshold
    );
  });

  test('long absence (>18h) → null (waits for the user, no nudge)', () => {
    expect(ladder({}, NOW - 70_000_000)).toBeNull();
  });

  test('user spoke since her last outreach → escalation resets (nudged → engaged, not renudge)', () => {
    // nudged, 2 sent, 800s since her nudge would renudge (720k backoff); but the user spoke 700s ago
    // (after that 800s-ago nudge) → reset to engaged → 700s ≥ idle_threshold → idle_nudge, NOT renudge
    expect(
      ladder({ phase: 'nudged', nudgesSent: 2, lastProactiveMs: NOW - 800_000 }, NOW - 700_000),
    ).toBe('idle_nudge');
  });

  test('idle_watch offers idle_nudge every eligible tick (no idle-threshold re-check)', () => {
    // a short gap that would NOT re-cross the 10m threshold, but she is already in idle_watch
    expect(
      ladder({ phase: 'idle_watch', lastProactiveMs: NOW - 400_000 }, NOW - 500_000),
    ).toBe('idle_nudge');
  });

  // ── the transitions must survive to the commit (the v0.24.0 review's confirmed defects) ──
  test('user-reset surfaces the reset base (phase idle_watch, nudgesSent 0) so the commit does not carry over', () => {
    // stale cadence says nudgesSent 2; the user replied mid-escalation → the evaluator resets
    const d = decide({ phase: 'nudged', nudgesSent: 2, lastProactiveMs: NOW - 800_000 }, NOW - 700_000);
    expect(d.scenario).toBe('idle_nudge');
    expect(d.phase).toBe('idle_watch');
    expect(d.nudgesSent).toBe(0);
    // committing from the effective base yields 1, NOT the stale 2+1=3 (which would skip the renudge tier)
    const committed = commitScenario(
      { ...baseCadence, phase: 'nudged', nudgesSent: 2 },
      d.scenario!,
      NOW,
      null,
      { phase: d.phase, nudgesSent: d.nudgesSent },
    );
    expect(committed.nudgesSent).toBe(1);
  });

  test('dormant recovery surfaces phase idle_watch (persistable) — not left as dormant (no lockout)', () => {
    const d = decide({ phase: 'dormant', nudgesSent: 3, lastProactiveMs: NOW - 4_000_000 }, NOW - 5_000_000);
    expect(d.scenario).toBe('idle_nudge');
    expect(d.phase).toBe('idle_watch'); // recovered dormant→engaged→idle_watch, so a silent tick persists it
    expect(d.nudgesSent).toBe(0);
  });

  test('long absence surfaces phase sleeping (persistable) so she waits for the user', () => {
    const d = decide({}, NOW - 70_000_000);
    expect(d.scenario).toBeNull();
    expect(d.phase).toBe('sleeping');
  });
});
