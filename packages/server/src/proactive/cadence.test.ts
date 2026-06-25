import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import { migrate } from '../sql';
import { setMemoryDb } from '../memory/sessionStore';
import {
  type Cadence,
  commitProactive,
  commitProactiveSilent,
  dateKey,
  loadCadence,
  passesAntiSpam,
  recordUserActivity,
  saveCadence,
  shouldConsiderWake,
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

const ctx = (over: Partial<{ lastUserMs: number; nowMs: number; nowHour: number }> = {}) => ({
  lastUserMs: NOW - 20 * 60_000, // 20 min gap
  nowMs: NOW,
  nowHour: 14, // 2pm
  ...over,
});

describe('shouldConsiderWake (prefilter)', () => {
  beforeEach(() => {
    Bun.env['LUNA_PROACTIVE'] = '1';
  });
  afterEach(() => {
    delete Bun.env['LUNA_PROACTIVE'];
    delete Bun.env['LUNA_PROACTIVE_QUIET_HOURS'];
  });

  test('disabled when LUNA_PROACTIVE=0 (kill switch; default ON since v0.11.0)', () => {
    Bun.env['LUNA_PROACTIVE'] = '0';
    expect(shouldConsiderWake(base, ctx()).reason).toBe('disabled');
  });
  test('quiet hours short-circuit', () => {
    expect(shouldConsiderWake(base, ctx({ nowHour: 3 })).reason).toBe('quiet_hours');
  });
  test('deep absence (>18h) → no wake', () => {
    expect(shouldConsiderWake(base, ctx({ lastUserMs: NOW - 19 * 3600_000 })).reason).toBe(
      'deep_absence',
    );
  });
  test('cooldown since last proactive', () => {
    expect(shouldConsiderWake({ ...base, lastProactiveMs: NOW - 60_000 }, ctx()).reason).toBe(
      'cooldown',
    );
  });
  test('daily quota exhausted', () => {
    const c = { ...base, quotaDate: TODAY, quotaUsed: 5 };
    expect(shouldConsiderWake(c, ctx()).reason).toBe('quota_exhausted');
  });
  test('too soon (gap below idle threshold)', () => {
    expect(shouldConsiderWake(base, ctx({ lastUserMs: NOW - 5 * 60_000 })).reason).toBe('too_soon');
  });
  test('idle past the threshold → consider', () => {
    const r = shouldConsiderWake(base, ctx());
    expect(r.consider).toBe(true);
    expect(r.reason).toBe('idle');
  });
  test('lull anchoring: her own recent message keeps the effective gap small', () => {
    // 20-min user gap, but she messaged 8 min ago → effective gap 8 min < threshold
    const c = { ...base, lastProactiveMs: NOW - 8 * 60_000 };
    expect(shouldConsiderWake(c, ctx()).reason).toBe('too_soon');
  });
});

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
  test('a fresh 0-min gap STILL passes (no too_soon floor — detectors decide, not the idle window)', () => {
    expect(passesAntiSpam(base, ctx({ lastUserMs: NOW })).ok).toBe(true);
  });
  test('normal → ok', () => {
    expect(passesAntiSpam(base, ctx()).ok).toBe(true);
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
