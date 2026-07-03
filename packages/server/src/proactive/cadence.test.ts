import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import { migrate } from '../sql';
import { setMemoryDb } from '../memory/sessionStore';
import {
  type Cadence,
  commitLadderPhase,
  commitLadderSilent,
  commitProactive,
  commitProactiveSilent,
  commitScenario,
  dateKey,
  loadCadence,
  passesAntiSpam,
  recordUserActivity,
  saveCadence,
} from './cadence';

const NOW = 1_700_000_000_000; // fixed 2023-11-14T22:13:20Z
const TODAY = dateKey(NOW);

const base: Cadence = {
  phase: 'engaged',
  quotaUsed: 0,
  quotaDate: '',
  lastProactiveMs: 0,
  nudgesSent: 0,
};

const ctx = (
  over: Partial<{ lastUserMs: number; lastActivityMs: number; nowMs: number; nowHour: number }> = {},
) => {
  const lastUserMs = over.lastUserMs ?? NOW - 20 * 60_000; // 20 min gap
  return {
    lastUserMs,
    // v0.29.0: the idle floor reads the activity anchor. Mirror lastUserMs by default so the
    // single-anchor tests below are unchanged; the split-anchor case sets it explicitly.
    lastActivityMs: over.lastActivityMs ?? lastUserMs,
    nowMs: over.nowMs ?? NOW,
    nowHour: over.nowHour ?? 14, // 2pm
  };
};

describe('cadence transitions', () => {
  test('commitProactive bumps quota same-day, resets on rollover, stamps time', () => {
    const sameDay = commitProactive({ ...base, quotaDate: TODAY, quotaUsed: 2 }, NOW);
    expect(sameDay.quotaUsed).toBe(3);
    expect(sameDay.lastProactiveMs).toBe(NOW);
    const rollover = commitProactive({ ...base, quotaDate: '2000-01-01', quotaUsed: 4 }, NOW);
    expect(rollover.quotaUsed).toBe(1);
    expect(rollover.quotaDate).toBe(TODAY);
  });
  test('recordUserActivity resets to engaged', () => {
    const c = recordUserActivity({ ...base, phase: 'dormant', nudgesSent: 3 });
    expect(c.phase).toBe('engaged');
    expect(c.nudgesSent).toBe(0);
  });
  test('commitProactiveSilent stamps the cooldown but does NOT bump the quota (v0.22.0)', () => {
    const c = commitProactiveSilent({ ...base, quotaDate: TODAY, quotaUsed: 2 }, NOW);
    expect(c.lastProactiveMs).toBe(NOW); // cooldown anchor stamped
    expect(c.quotaUsed).toBe(2); // ...but a silent draft does not consume the daily budget
    expect(c.quotaDate).toBe(TODAY);
  });
});

describe('passesAntiSpam (v0.22.0 detector gate — anti-spam subset only)', () => {
  test('disabled when LUNA_PROACTIVE=0', () => {
    Bun.env['LUNA_PROACTIVE'] = '0';
    expect(passesAntiSpam(base, ctx()).reason).toBe('disabled');
    delete Bun.env['LUNA_PROACTIVE'];
  });
  test('quiet hours block', () => {
    expect(passesAntiSpam(base, ctx({ nowHour: 3 })).reason).toBe('quiet_hours');
  });
  test('cooldown blocks (< 5m since last proactive)', () => {
    expect(passesAntiSpam({ ...base, lastProactiveMs: NOW - 60_000 }, ctx()).reason).toBe('cooldown');
  });
  test('daily quota exhausted blocks', () => {
    expect(passesAntiSpam({ ...base, quotaDate: TODAY, quotaUsed: 5 }, ctx()).reason).toBe(
      'quota_exhausted',
    );
  });
  test('a > 18h gap STILL passes (no deep_absence cut — the redesign HIGH fix)', () => {
    expect(passesAntiSpam(base, ctx({ lastUserMs: NOW - 40 * 3600_000 })).ok).toBe(true);
  });
  test('a 2-min gap passes (the old 10m too_soon floor is gone — detectors decide)', () => {
    expect(passesAntiSpam(base, ctx({ lastUserMs: NOW - 2 * 60_000 })).ok).toBe(true);
  });
  test('a 0-min gap is blocked by the small idle floor (no interrupting a live exchange)', () => {
    expect(passesAntiSpam(base, ctx({ lastUserMs: NOW })).reason).toBe('mid_conversation');
  });
  test('normal → ok', () => {
    expect(passesAntiSpam(base, ctx()).ok).toBe(true);
  });

  // v0.29.0/.1: a long reactive turn — the user spoke 65s ago (turn start), but Luna's reply only
  // finished 5s ago. The floor measures from her reply (activity), not the user's message, or the
  // "don't reach in mid-exchange" guard is dead the instant she finishes a slow turn.
  test('long reply: the idle floor reads the activity anchor, not the old user message', () => {
    const c = ctx({ lastUserMs: NOW - 65_000, lastActivityMs: NOW - 5_000 });
    expect(passesAntiSpam(base, c).reason).toBe('mid_conversation');
  });
});

describe('commitScenario (ladder emission, v0.24.0)', () => {
  test('idle_nudge → nudged + nudgesSent++, quota bumped, time stamped', () => {
    const c = commitScenario({ ...base, phase: 'engaged', nudgesSent: 0 }, 'idle_nudge', NOW);
    expect(c.phase).toBe('nudged');
    expect(c.nudgesSent).toBe(1);
    expect(c.quotaUsed).toBe(1);
    expect(c.lastProactiveMs).toBe(NOW);
  });

  test('renudge → nudged + nudgesSent++ (escalation continues)', () => {
    const c = commitScenario({ ...base, phase: 'nudged', nudgesSent: 1 }, 'renudge', NOW);
    expect(c.phase).toBe('nudged');
    expect(c.nudgesSent).toBe(2);
  });

  test('leave_message → dormant (winds down)', () => {
    const c = commitScenario({ ...base, phase: 'nudged', nudgesSent: 3 }, 'leave_message', NOW);
    expect(c.phase).toBe('dormant');
  });

  test('ambient stays in the current phase but still consumes quota', () => {
    const c = commitScenario({ ...base, phase: 'engaged' }, 'ambient', NOW);
    expect(c.phase).toBe('engaged');
    expect(c.nudgesSent).toBe(0);
    expect(c.quotaUsed).toBe(1);
  });

  test('follow_up:false forces dormant regardless of the mechanical phase', () => {
    const c = commitScenario({ ...base, phase: 'engaged' }, 'idle_nudge', NOW, false);
    expect(c.phase).toBe('dormant');
  });

  test('quota rolls over on a new local day', () => {
    const c = commitScenario({ ...base, quotaDate: '2000-01-01', quotaUsed: 4 }, 'idle_nudge', NOW);
    expect(c.quotaUsed).toBe(1);
    expect(c.quotaDate).toBe(TODAY);
  });

  test('advances from the EFFECTIVE base, not the stale cadence (the user-reset carry-over fix)', () => {
    // stale cadence says nudgesSent 2; the evaluator reset it to 0 this tick → commit must use 0
    const c = commitScenario({ ...base, phase: 'nudged', nudgesSent: 2 }, 'idle_nudge', NOW, null, {
      phase: 'idle_watch',
      nudgesSent: 0,
    });
    expect(c.nudgesSent).toBe(1); // 0 + 1, NOT 2 + 1 = 3
    expect(c.phase).toBe('nudged');
  });
});

describe('ladder silent/null commits (v0.24.0)', () => {
  test('commitLadderSilent stamps the cooldown + persists the phase, but no quota/nudge', () => {
    const c = commitLadderSilent({ ...base, quotaUsed: 2, nudgesSent: 1 }, 'idle_watch', 1, NOW);
    expect(c.phase).toBe('idle_watch');
    expect(c.lastProactiveMs).toBe(NOW);
    expect(c.quotaUsed).toBe(2); // NOT bumped
    expect(c.nudgesSent).toBe(1); // NOT bumped
  });

  test('commitLadderPhase persists the phase WITHOUT stamping lastProactiveMs (no clock re-arm)', () => {
    const c = commitLadderPhase({ ...base, lastProactiveMs: 12_345, phase: 'dormant' }, 'engaged', 0);
    expect(c.phase).toBe('engaged');
    expect(c.lastProactiveMs).toBe(12_345); // unchanged — the recovery clock keeps accruing
  });
});

describe('cadence persistence (restart-survival)', () => {
  let db: Database;
  beforeEach(() => {
    db = new Database(':memory:', { strict: true });
    migrate(db, join(import.meta.dir, '..', 'migrations'));
    setMemoryDb(db);
  });
  afterEach(() => {
    setMemoryDb(null);
    db.close(false);
  });

  test('default cadence when no row', () => {
    expect(loadCadence('nope')).toEqual(base);
  });
  test('save then load round-trips (upsert when no prior row)', () => {
    const c: Cadence = { phase: 'dormant', quotaUsed: 3, quotaDate: TODAY, lastProactiveMs: NOW, nudgesSent: 2 };
    saveCadence('s1', c);
    expect(loadCadence('s1')).toEqual(c);
  });
  test('survives a simulated restart (reload from the same db)', () => {
    saveCadence('s2', { ...base, quotaUsed: 4, quotaDate: TODAY, lastProactiveMs: NOW });
    // a fresh store over the same db (the restart) sees the persisted cadence
    expect(loadCadence('s2').quotaUsed).toBe(4);
    expect(loadCadence('s2').lastProactiveMs).toBe(NOW);
  });
});
