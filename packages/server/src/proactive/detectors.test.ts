import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import { migrate } from '../sql';
import { appendL2, setMemoryDb } from '../memory/sessionStore';
import { addFact } from '../memory/l3Store';
import { getSession, resetSessions } from '../turn/session';
import { resetWeatherSnapshotForTests, setSnapshotForTests } from '../tools/web/weather/snapshot';
import type { WeatherSnapshot } from '../tools/web/weather/openMeteo';
import { type Cadence, dateKey } from './cadence';
import { evaluateDetectors, resetWeatherBaselineForTests, type DetectorCtx } from './detectors';

const NOW = 1_700_000_000_000;
const baseCadence: Cadence = {
  phase: 'engaged',
  quotaUsed: 0,
  quotaDate: '',
  lastProactiveMs: 0,
  nudgesSent: 0,
  slotsUsed: 0,
  slotsDate: '',
};

// No memory DB → lastInteractionMs(session) returns null for a fresh (turnSeq 0)
// session → afterANightOpening is false → the afterNight detector is null. So these
// tests isolate the scheduledWindow detector + the registry ordering.
beforeEach(() => {
  setMemoryDb(null);
  resetSessions();
});
afterEach(() => {
  delete Bun.env['LUNA_PROACTIVE_SLOTS'];
  resetSessions();
});

const ctx = (nowHour: number, cadence: Cadence = baseCadence): DetectorCtx => ({
  session: getSession('default'),
  cadence,
  nowMs: NOW,
  nowHour,
});

describe('proactive detectors (v0.22.1)', () => {
  test('scheduledWindow fires at a configured hour when the slot is unconsumed', () => {
    Bun.env['LUNA_PROACTIVE_SLOTS'] = '11,20';
    const hit = evaluateDetectors(ctx(11));
    expect(hit?.debounceKey).toBe('slot:11');
    expect(hit?.intent).toBe('spontaneous');
  });

  test('scheduledWindow is null off-slot', () => {
    Bun.env['LUNA_PROACTIVE_SLOTS'] = '11,20';
    expect(evaluateDetectors(ctx(9))).toBeNull();
  });

  test('scheduledWindow is null when that slot already fired today', () => {
    Bun.env['LUNA_PROACTIVE_SLOTS'] = '11';
    const consumed: Cadence = { ...baseCadence, slotsUsed: 1 << 11, slotsDate: dateKey(NOW) };
    expect(evaluateDetectors(ctx(11, consumed))).toBeNull();
    // ...but a stale slotsDate (yesterday) does not count as consumed
    const stale: Cadence = { ...baseCadence, slotsUsed: 1 << 11, slotsDate: '2000-01-01' };
    expect(evaluateDetectors(ctx(11, stale))?.debounceKey).toBe('slot:11');
  });

  test('no slots + no prior interaction → no detector fires (afterNight null)', () => {
    expect(evaluateDetectors(ctx(11))).toBeNull();
  });
});

// observedMs must be ~now so getSnapshot() doesn't treat the canned snapshot as stale (its
// staleness check uses the real clock); the bucket only reads condition + temp.
function snap(condition: string, temp: number): WeatherSnapshot {
  return {
    label: 'Home',
    temp,
    feelsLike: temp,
    condition,
    code: 0,
    isDay: true,
    precipMm: 0,
    windKmh: 5,
    high: temp + 2,
    low: temp - 2,
    precipChance: 0,
    sunrise: '',
    sunset: '',
    units: 'celsius',
    observedMs: Date.now(),
  };
}

describe('weatherShift detector (v0.22.2)', () => {
  beforeEach(() => {
    resetWeatherBaselineForTests();
    resetWeatherSnapshotForTests();
  });
  afterEach(() => {
    resetWeatherBaselineForTests();
    resetWeatherSnapshotForTests();
    delete Bun.env['LUNA_PROACTIVE_WEATHER_SHIFT'];
  });

  test('null when the snapshot is cold (no weather cached)', () => {
    setSnapshotForTests(null);
    expect(evaluateDetectors(ctx(14))).toBeNull();
  });

  test('first observation seeds the baseline, does not fire', () => {
    setSnapshotForTests(snap('clear', 18));
    expect(evaluateDetectors(ctx(14))).toBeNull(); // can't shift from nothing
  });

  test('fires once on a notable condition-class change, not on same-bucket noise', () => {
    setSnapshotForTests(snap('clear', 18)); // baseline = clear:mild
    evaluateDetectors(ctx(14));
    setSnapshotForTests(snap('light rain', 17)); // → rain:mild — the class changed
    const hit = evaluateDetectors(ctx(14));
    expect(hit?.debounceKey).toBe('weather:rain:mild');
    expect(hit?.intent).toBe('spontaneous');
    // a fluctuation within the same bucket (still rain, still mild) does NOT re-fire
    setSnapshotForTests(snap('rain', 16));
    expect(evaluateDetectors(ctx(14))).toBeNull();
  });

  test('LUNA_PROACTIVE_WEATHER_SHIFT=0 disables it', () => {
    Bun.env['LUNA_PROACTIVE_WEATHER_SHIFT'] = '0';
    setSnapshotForTests(snap('clear', 18));
    evaluateDetectors(ctx(14));
    setSnapshotForTests(snap('thunderstorm', 25));
    expect(evaluateDetectors(ctx(14))).toBeNull();
  });
});

// The two soft detectors read DB state (L3 active_threads / L2 turns) — give them a real DB.
// `appendL2`/`addFact` stamp t_ms/created_ms at the real Date.now(); to simulate "aged" we run
// the detector with a future-shifted ctx.nowMs (the detectors compare against ctx.nowMs).
const HOUR = 3_600_000;
describe('fuzzy detectors (v0.22.3, default-off)', () => {
  let fdb: Database;
  beforeEach(() => {
    fdb = new Database(':memory:', { strict: true });
    migrate(fdb, join(import.meta.dir, '..', 'migrations'));
    setMemoryDb(fdb);
    resetSessions();
  });
  afterEach(() => {
    setMemoryDb(null);
    fdb.close(false);
    delete Bun.env['LUNA_PROACTIVE_OPEN_THREADS'];
    delete Bun.env['LUNA_PROACTIVE_FOLLOW_THROUGH'];
    delete Bun.env['LUNA_PROACTIVE_PROMISE_AGE_MS'];
    delete Bun.env['LUNA_PROACTIVE_PROMISE_MAX_AGE_MS'];
  });

  const dbCtx = (nowMs: number): DetectorCtx => ({
    session: getSession('default'),
    cadence: baseCadence,
    nowMs,
    nowHour: 14, // afternoon — keeps afterNight off regardless of the real clock
  });

  describe('openThreadAged', () => {
    test('fires past the age threshold when the flag is on, soft seed names the thread', () => {
      Bun.env['LUNA_PROACTIVE_OPEN_THREADS'] = '1';
      addFact('active_threads', 'the database migration plan');
      const hit = evaluateDetectors(dbCtx(Date.now() + 48 * HOUR)); // 48h "later" > 24h default
      expect(hit?.debounceKey).toMatch(/^thread:at_/);
      expect(hit?.seed).toContain('the database migration plan');
      expect(hit?.intent).toBe('spontaneous');
    });

    test('null when the thread is not yet aged', () => {
      Bun.env['LUNA_PROACTIVE_OPEN_THREADS'] = '1';
      addFact('active_threads', 'a fresh thread');
      expect(evaluateDetectors(dbCtx(Date.now()))).toBeNull();
    });

    test('null with the flag off (default)', () => {
      addFact('active_threads', 'a thread');
      expect(evaluateDetectors(dbCtx(Date.now() + 48 * HOUR))).toBeNull();
    });
  });

  describe('promisedFollowThrough', () => {
    const promise = () =>
      appendL2({
        sessionId: 'default',
        turnId: 'reactive:1',
        userText: 'can you find that doc?',
        assistantText: "Sure — I'll look into it and get back to you.",
        rawContent: [],
      });

    test('fires when the newest turn is an aged promise and the flag is on', () => {
      Bun.env['LUNA_PROACTIVE_FOLLOW_THROUGH'] = '1';
      Bun.env['LUNA_PROACTIVE_PROMISE_AGE_MS'] = String(HOUR); // 1h threshold
      promise();
      const hit = evaluateDetectors(dbCtx(Date.now() + 2 * HOUR)); // 2h later, no follow-up
      expect(hit?.debounceKey).toMatch(/^promise:/);
      expect(hit?.seed).toContain('follow up');
    });

    test('null when the last turn is not a promise', () => {
      Bun.env['LUNA_PROACTIVE_FOLLOW_THROUGH'] = '1';
      Bun.env['LUNA_PROACTIVE_PROMISE_AGE_MS'] = String(HOUR);
      appendL2({
        sessionId: 'default',
        turnId: 'reactive:1',
        userText: 'hi',
        assistantText: 'Hey — good to see you.',
        rawContent: [],
      });
      expect(evaluateDetectors(dbCtx(Date.now() + 2 * HOUR))).toBeNull();
    });

    test('null with the flag off (default), even with an aged promise', () => {
      Bun.env['LUNA_PROACTIVE_PROMISE_AGE_MS'] = String(HOUR);
      promise();
      expect(evaluateDetectors(dbCtx(Date.now() + 2 * HOUR))).toBeNull();
    });

    test('null when the promise is too recent (followed up within the window)', () => {
      Bun.env['LUNA_PROACTIVE_FOLLOW_THROUGH'] = '1'; // default 6h threshold
      promise();
      expect(evaluateDetectors(dbCtx(Date.now() + 1 * HOUR))).toBeNull(); // 1h < 6h
    });

    test('null for an empathy line that is not a real promise (tightened regex)', () => {
      Bun.env['LUNA_PROACTIVE_FOLLOW_THROUGH'] = '1';
      Bun.env['LUNA_PROACTIVE_PROMISE_AGE_MS'] = String(HOUR);
      appendL2({
        sessionId: 'default',
        turnId: 'reactive:1',
        userText: 'i feel stuck',
        assistantText: "I can see why that feels heavy. I'll see you tomorrow, okay?",
        rawContent: [],
      });
      expect(evaluateDetectors(dbCtx(Date.now() + 2 * HOUR))).toBeNull();
    });

    test('null once abandoned past the max-age window (no infinite re-fire)', () => {
      Bun.env['LUNA_PROACTIVE_FOLLOW_THROUGH'] = '1';
      Bun.env['LUNA_PROACTIVE_PROMISE_AGE_MS'] = String(HOUR);
      Bun.env['LUNA_PROACTIVE_PROMISE_MAX_AGE_MS'] = String(4 * HOUR);
      promise();
      expect(evaluateDetectors(dbCtx(Date.now() + 2 * HOUR))?.debounceKey).toMatch(/^promise:/);
      expect(evaluateDetectors(dbCtx(Date.now() + 10 * HOUR))).toBeNull(); // past max → abandoned
    });
  });
});
