import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { afterANightOpening } from '../turn/temporalContext';
import { weatherNoteFor, weatherProactiveEnabled } from '../turn/weatherContext';
import { proactiveWeatherNote } from './proactiveTurn';
import { getSession, resetSessions } from '../turn/session';
import { setMemoryDb } from '../memory/sessionStore';
import {
  resetWeatherSnapshotForTests,
  setSnapshotForTests,
} from '../tools/web/weather/snapshot';
import type { WeatherSnapshot } from '../tools/web/weather/openMeteo';

const ENV = ['LUNA_LAT_LON', 'LUNA_TZ', 'LUNA_WEATHER_PROACTIVE', 'LUNA_NIGHT_MIN_GAP_SEC'];
const saved: Record<string, string | undefined> = {};

// Asia/Shanghai = UTC+8, no DST → local hour = UTC hour + 8.
const TZ = 'Asia/Shanghai';
const MORNING = Date.UTC(2026, 5, 21, 0, 0, 0); // 2026-06-21 08:00 Shanghai
const AFTERNOON = Date.UTC(2026, 5, 21, 7, 0, 0); // 2026-06-21 15:00 Shanghai
const OVERNIGHT_LAST = Date.UTC(2026, 5, 20, 15, 0, 0); // 2026-06-20 23:00 Shanghai (9h before MORNING)
const TWO_DAYS_LAST = Date.UTC(2026, 5, 19, 0, 0, 0); // 2026-06-19 08:00 Shanghai
const SAME_MORNING_LAST = Date.UTC(2026, 5, 20, 23, 30, 0); // 2026-06-21 07:30 Shanghai (30m before MORNING)

beforeEach(() => {
  for (const k of ENV) saved[k] = Bun.env[k];
  resetSessions();
  resetWeatherSnapshotForTests();
  setMemoryDb(null);
  Bun.env['LUNA_TZ'] = TZ;
  Bun.env['LUNA_LAT_LON'] = '31.23,121.47';
});
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete Bun.env[k];
    else Bun.env[k] = saved[k];
  }
  resetWeatherSnapshotForTests();
  setMemoryDb(null);
});

function snap(over: Partial<WeatherSnapshot> = {}): WeatherSnapshot {
  return {
    label: 'Shanghai',
    temp: 18,
    feelsLike: 17,
    condition: 'overcast',
    code: 3,
    isDay: true,
    precipMm: 0,
    windKmh: 9,
    high: 21,
    low: 14,
    precipChance: 40,
    sunrise: 'x',
    sunset: 'y',
    units: 'celsius',
    observedMs: Date.now(),
    ...over,
  };
}

describe('afterANightOpening', () => {
  test('overnight (≥6h) gap crossing midnight into the morning → true', () => {
    expect(afterANightOpening(MORNING, OVERNIGHT_LAST, TZ)).toBe(true);
  });
  test('long-away (≥24h) into the morning → true', () => {
    expect(afterANightOpening(MORNING, TWO_DAYS_LAST, TZ)).toBe(true);
  });
  test('afternoon wake → false (not morning)', () => {
    expect(afterANightOpening(AFTERNOON, OVERNIGHT_LAST, TZ)).toBe(false);
  });
  test('a short same-morning gap → false (below the 6h min-gap)', () => {
    expect(afterANightOpening(MORNING, SAME_MORNING_LAST, TZ)).toBe(false);
  });
  test('no last interaction → false', () => {
    expect(afterANightOpening(MORNING, null, TZ)).toBe(false);
  });
  test('LUNA_NIGHT_MIN_GAP_SEC raises the bar (10h excludes the 9h overnight)', () => {
    Bun.env['LUNA_NIGHT_MIN_GAP_SEC'] = '36000';
    expect(afterANightOpening(MORNING, OVERNIGHT_LAST, TZ)).toBe(false);
  });
});

describe('weatherNoteFor', () => {
  test('null snapshot → null', () => {
    expect(weatherNoteFor(null)).toBeNull();
  });
  test('names the condition and carries the only-if-natural guardrail', () => {
    const note = weatherNoteFor(snap());
    expect(note).toContain('overcast');
    // v0.27.6: the "never a forecast / status report" rule moved to the cached
    // WEATHER_CLAUSE (was duplicated); the note keeps the only-if-natural guardrail.
    expect(note).toContain('if it feels natural');
  });
});

describe('weatherProactiveEnabled', () => {
  test('default-on since v0.21.2, gated on a configured location', () => {
    delete Bun.env['LUNA_WEATHER_PROACTIVE'];
    expect(weatherProactiveEnabled()).toBe(true);
    Bun.env['LUNA_WEATHER_PROACTIVE'] = '0';
    expect(weatherProactiveEnabled()).toBe(false);
    Bun.env['LUNA_WEATHER_PROACTIVE'] = '1';
    expect(weatherProactiveEnabled()).toBe(true);
    delete Bun.env['LUNA_LAT_LON'];
    expect(weatherProactiveEnabled()).toBe(false);
  });
});

describe('proactiveWeatherNote (the framing wire)', () => {
  function nightSession() {
    const s = getSession('p');
    s.turnSeq = 1;
    s.lastUserMs = OVERNIGHT_LAST;
    return s;
  }

  test('morning + overnight + a cached snapshot → the weather-aware note', () => {
    setSnapshotForTests(snap());
    expect(proactiveWeatherNote(nightSession(), MORNING)).toContain('if it feels natural');
  });
  test('afternoon wake → no note', () => {
    setSnapshotForTests(snap());
    expect(proactiveWeatherNote(nightSession(), AFTERNOON)).toBe('');
  });
  test('cold cache → no note (never invents weather)', () => {
    resetWeatherSnapshotForTests();
    expect(proactiveWeatherNote(nightSession(), MORNING)).toBe('');
  });
  test('proactive weather off → no note', () => {
    Bun.env['LUNA_WEATHER_PROACTIVE'] = '0';
    setSnapshotForTests(snap());
    expect(proactiveWeatherNote(nightSession(), MORNING)).toBe('');
  });
});
