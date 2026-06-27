import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { setMemoryDb } from '../memory/sessionStore';
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
