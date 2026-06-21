import { afterEach, describe, expect, test } from 'bun:test';
import { buildUrl, fetchWeather, setWeatherFetcher, wmoToCondition } from './openMeteo';

afterEach(() => setWeatherFetcher(null));

describe('wmoToCondition', () => {
  test('maps known WMO codes to human conditions', () => {
    expect(wmoToCondition(0)).toBe('clear');
    expect(wmoToCondition(3)).toBe('overcast');
    expect(wmoToCondition(63)).toBe('rain');
    expect(wmoToCondition(75)).toBe('heavy snow');
    expect(wmoToCondition(95)).toBe('thunderstorm');
  });

  test('an unknown code falls back to wet/dry by precipitation', () => {
    expect(wmoToCondition(999, 0)).toBe('unknown');
    expect(wmoToCondition(999, 2.5)).toBe('wet');
  });
});

describe('buildUrl', () => {
  test('emits the documented Open-Meteo params', () => {
    const url = buildUrl(31.23, 121.47, 'Asia/Shanghai', 'celsius');
    expect(url.startsWith('https://api.open-meteo.com/v1/forecast?')).toBe(true);
    expect(url).toContain('latitude=31.23');
    expect(url).toContain('longitude=121.47');
    expect(url).toContain(
      'current=temperature_2m,apparent_temperature,weather_code,precipitation,is_day,wind_speed_10m',
    );
    expect(url).toContain(
      'daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code,sunrise,sunset',
    );
    expect(url).toContain('timezone=Asia%2FShanghai');
    expect(url).toContain('temperature_unit=celsius');
  });
});

const CANNED = {
  current: {
    temperature_2m: 18.4,
    apparent_temperature: 17.1,
    weather_code: 3,
    precipitation: 0,
    is_day: 1,
    wind_speed_10m: 9.2,
  },
  daily: {
    temperature_2m_max: [21.3, 22],
    temperature_2m_min: [14.1, 15],
    precipitation_probability_max: [40, 10],
    weather_code: [61, 3],
    sunrise: ['2026-06-21T05:00', '2026-06-22T05:01'],
    sunset: ['2026-06-21T19:01', '2026-06-22T19:01'],
  },
};

describe('fetchWeather (seam-injected, network-free)', () => {
  test('maps canned Open-Meteo JSON to a WeatherSnapshot', async () => {
    setWeatherFetcher(async () => CANNED);
    const snap = await fetchWeather(31.23, 121.47, 'Asia/Shanghai', 'Shanghai');
    expect(snap.label).toBe('Shanghai');
    expect(snap.temp).toBe(18.4);
    expect(snap.feelsLike).toBe(17.1);
    expect(snap.condition).toBe('overcast');
    expect(snap.isDay).toBe(true);
    expect(snap.high).toBe(21.3);
    expect(snap.low).toBe(14.1);
    expect(snap.precipChance).toBe(40);
    expect(snap.units).toBe('celsius');
    expect(snap.observedMs).toBeGreaterThan(0);
  });

  test('a malformed payload throws (caught as soft-fail by the tool)', async () => {
    setWeatherFetcher(async () => ({ nope: true }));
    await expect(fetchWeather(0, 0, 'UTC', 'x')).rejects.toThrow();
  });
});
