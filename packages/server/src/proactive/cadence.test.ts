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
  isSlotConsumed,
  loadCadence,
  markSlotConsumed,
  passesAntiSpam,
  recordUserActivity,
  saveCadence,
  scheduledSlots,
} from './cadence';

const NOW = 1_700_000_000_000; // fixed 2023-11-14T22:13:20Z
const TODAY = dateKey(NOW);

const base: Cadence = {
  phase: 'engaged',
  quotaUsed: 0,
  quotaDate: '',
  lastProactiveMs: 0,
  nudgesSent: 0,
  slotsUsed: 0,
  slotsDate: '',
};

const ctx = (over: Partial<{ lastUserMs: number; nowMs: number; nowHour: number }> = {}) => ({
  lastUserMs: NOW - 20 * 60_000, // 20 min gap
  nowMs: NOW,
  nowHour: 14, // 2pm
  ...over,
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
  test('a 2-min gap passes (the old 10m too_soon floor is gone — detectors decide)', () => {
    expect(passesAntiSpam(base, ctx({ lastUserMs: NOW - 2 * 60_000 })).ok).toBe(true);
  });
  test('a 0-min gap is blocked by the small idle floor (no interrupting a live exchange)', () => {
    expect(passesAntiSpam(base, ctx({ lastUserMs: NOW })).reason).toBe('mid_conversation');
  });
  test('normal → ok', () => {
    expect(passesAntiSpam(base, ctx()).ok).toBe(true);
  });
});

describe('scheduled slots (v0.22.1)', () => {
  afterEach(() => delete Bun.env['LUNA_PROACTIVE_SLOTS']);
  test('scheduledSlots parses LUNA_PROACTIVE_SLOTS; unset → empty', () => {
    expect(scheduledSlots()).toEqual([]);
    Bun.env['LUNA_PROACTIVE_SLOTS'] = '11, 20';
    expect(scheduledSlots()).toEqual([11, 20]);
    Bun.env['LUNA_PROACTIVE_SLOTS'] = '11,99,xx,5';
    expect(scheduledSlots()).toEqual([11, 5]); // out-of-range / non-numeric dropped
  });
  test('markSlotConsumed sets the hour bit; isSlotConsumed reads it; resets on a new day', () => {
    expect(isSlotConsumed(base, 11, NOW)).toBe(false);
    const c = markSlotConsumed(base, 11, NOW);
    expect(isSlotConsumed(c, 11, NOW)).toBe(true);
    expect(isSlotConsumed(c, 20, NOW)).toBe(false); // a different slot is untouched
    const c2 = markSlotConsumed(c, 20, NOW);
    expect(isSlotConsumed(c2, 11, NOW)).toBe(true); // both bits set same day
    expect(isSlotConsumed(c2, 20, NOW)).toBe(true);
    // a new day clears the mask
    const nextDay = NOW + 24 * 3600_000;
    expect(isSlotConsumed(c2, 11, nextDay)).toBe(false);
    expect(isSlotConsumed(markSlotConsumed(c2, 11, nextDay), 20, nextDay)).toBe(false);
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
    const c: Cadence = { phase: 'dormant', quotaUsed: 3, quotaDate: TODAY, lastProactiveMs: NOW, nudgesSent: 2, slotsUsed: 0, slotsDate: '' };
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
