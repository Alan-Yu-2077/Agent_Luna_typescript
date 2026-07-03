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

function sess(lastUserMs: number, lastActivityMs: number = lastUserMs): Session {
  const s = getSession('default');
  s.lastUserMs = lastUserMs;
  // v0.29.0: the silence gap now reads lastActivityMs. Default it to lastUserMs so the
  // single-anchor tests keep their meaning ("silence since T"); the reported-bug test
  // sets a later activity time to model her reply landing after the user's message.
  s.lastActivityMs = lastActivityMs;
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
    expect(ladder({}, NOW - 360_000, always(0))).toBe('ambient'); // 6m (≥5m min, <10m thresh), roll hits
    expect(ladder({}, NOW - 360_000, always(0.99))).toBeNull(); // roll misses
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

// Initiative 21 (v0.29.0): silence reads the activity idle-timer, not the user-only anchor.
describe('evaluateLadder — silence idle-timer (v0.29.0)', () => {
  const evalWith = (session: Session, rng = always(0)): string | null =>
    evaluateLadder({ session, cadence: { ...baseCadence }, nowMs: NOW, nowHour: 14 }, rng).scenario;

  test('the reported bug: she does NOT ambient into a conversation she just replied to', () => {
    // user spoke 120s ago, her reply finished 30s ago. silenceGap = 30s < ambientMin (5m) → quiet.
    // (Pre-v0.29.0 the gap would count the 120s-old user msg and she'd interrupt.)
    expect(evalWith(sess(NOW - 120_000, NOW - 30_000))).toBeNull();
  });

  test('ambient is not eligible until the silence gap reaches ambientMin (5m)', () => {
    // v0.29.1 default 300s: a 4m lull is still too short to call silence, even with rng 0.
    expect(evalWith(sess(NOW - 240_000))).toBeNull(); // 4m < 5m → quiet
    expect(evalWith(sess(NOW - 360_000))).toBe('ambient'); // 6m ≥ 5m → eligible, roll hits
  });

  test('her recent reply also suppresses an idle_nudge the stale user gap would trigger', () => {
    // user quiet 11m (would idle_nudge on the old anchor) but she replied 40s ago → silenceGap 40s → quiet
    expect(evalWith(sess(NOW - 700_000, NOW - 40_000))).toBeNull();
  });

  test('a genuine silence (activity anchor old) still escalates normally', () => {
    // no reply since the user's 11m-ago message → activity == user → idle_nudge, unchanged
    expect(evalWith(sess(NOW - 700_000))).toBe('idle_nudge');
  });

  test('bounded ambient rate: a 15-min silence stays comfortably quiet (v0.29.1 defaults)', () => {
    // Walk 60s ticks; count the AMBIENT-eligible ones by firing with rng 0 (always hits). The band
    // is [ambientMin 5m, idleThreshold 10m) → 5 ticks (300..540s); 600s+ escalates to idle_nudge.
    let eligible = 0;
    for (let gapMs = 0; gapMs <= 15 * 60_000; gapMs += 60_000) {
      if (evalWith(sess(NOW - gapMs)) === 'ambient') eligible += 1;
    }
    expect(eligible).toBe(5);
    // Cumulative P(≥1 ambient) over those 5 independent rolls at ambientProb 0.06 — was ~0.64 at the
    // old 0.12 / 8-tick (2m..10m) defaults; now comfortably bounded.
    expect(1 - Math.pow(1 - 0.06, eligible)).toBeLessThan(0.3);
  });

  test('the escalation reset still keys on the USER anchor, not activity', () => {
    // her ambient reply bumped activity 40s ago, but the user last spoke 700s ago (after her prior
    // nudge 800s ago) → the user-reset fires (nudged→engaged) and, at an 11m user gap, idle_nudge
    const s = sess(NOW - 700_000, NOW - 40_000);
    const d = evaluateLadder(
      { session: s, cadence: { ...baseCadence, phase: 'nudged', nudgesSent: 2, lastProactiveMs: NOW - 800_000 }, nowMs: NOW, nowHour: 14 },
      always(0),
    );
    // activity is recent (40s) so the silence gap is short → she stays quiet THIS tick, but the
    // phase must have reset off the user anchor (not carried the stale nudged/2).
    expect(d.phase).toBe('engaged');
    expect(d.nudgesSent).toBe(0);
    expect(d.scenario).toBeNull(); // 40s silence < ambientMin → nothing fires, correctly
  });
});
