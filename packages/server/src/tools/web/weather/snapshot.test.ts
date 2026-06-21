import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  getSnapshot,
  refreshWeather,
  resetWeatherSnapshotForTests,
  setSnapshotForTests,
} from './snapshot';
import { setWeatherFetcher, type WeatherSnapshot } from './openMeteo';

const ENV = ['LUNA_LAT_LON', 'LUNA_WEATHER_TTL_MIN', 'LUNA_WEATHER_UNITS'];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV) saved[k] = Bun.env[k];
  resetWeatherSnapshotForTests();
});
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete Bun.env[k];
    else Bun.env[k] = saved[k];
  }
  resetWeatherSnapshotForTests();
  setWeatherFetcher(null);
});

const CANNED = {
  current: {
    temperature_2m: 18,
    apparent_temperature: 17,
    weather_code: 3,
    precipitation: 0,
    is_day: 1,
    wind_speed_10m: 9,
  },
  daily: {
    temperature_2m_max: [21],
    temperature_2m_min: [14],
    precipitation_probability_max: [40],
    weather_code: [3],
    sunrise: ['x'],
    sunset: ['y'],
  },
};

describe('weather snapshot cache', () => {
  test('cold cache → getSnapshot() is null', () => {
    expect(getSnapshot()).toBeNull();
  });

  test('refreshWeather populates the snapshot, read synchronously after', async () => {
    Bun.env['LUNA_LAT_LON'] = '31.23,121.47';
    setWeatherFetcher(async () => CANNED);
    await refreshWeather();
    const s = getSnapshot();
    expect(s).not.toBeNull();
    expect(s?.temp).toBe(18);
    expect(s?.condition).toBe('overcast');
  });

  test('refresh with no location is a no-op (never throws, stays cold)', async () => {
    delete Bun.env['LUNA_LAT_LON'];
    setWeatherFetcher(() => {
      throw new Error('should not be called');
    });
    await refreshWeather();
    expect(getSnapshot()).toBeNull();
  });

  test('a failing refresh keeps the last good snapshot (never throws)', async () => {
    Bun.env['LUNA_LAT_LON'] = '31.23,121.47';
    setWeatherFetcher(async () => CANNED);
    await refreshWeather();
    expect(getSnapshot()?.temp).toBe(18);
    setWeatherFetcher(() => {
      throw new Error('network down');
    });
    await refreshWeather();
    expect(getSnapshot()?.temp).toBe(18);
  });

  test('a snapshot older than maxAge reads as null (omit stale weather)', () => {
    Bun.env['LUNA_WEATHER_TTL_MIN'] = '30';
    const old: WeatherSnapshot = {
      label: 'x',
      temp: 1,
      feelsLike: null,
      condition: 'clear',
      code: 0,
      isDay: true,
      precipMm: 0,
      windKmh: 0,
      high: 1,
      low: 1,
      precipChance: 0,
      sunrise: '',
      sunset: '',
      units: 'celsius',
      observedMs: Date.now() - 3 * 60 * 60 * 1000,
    };
    setSnapshotForTests(old);
    expect(getSnapshot()).toBeNull();
  });
});
