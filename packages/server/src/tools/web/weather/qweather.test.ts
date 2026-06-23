import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { fetchQWeather, setQWeatherFetcher } from './qweather';

const ENV = ['LUNA_WEATHER_API_HOST', 'LUNA_WEATHER_API_KEY'];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV) saved[k] = Bun.env[k];
  Bun.env['LUNA_WEATHER_API_HOST'] = 'test.qweatherapi.com';
  Bun.env['LUNA_WEATHER_API_KEY'] = 'testkey';
});
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete Bun.env[k];
    else Bun.env[k] = saved[k];
  }
  setQWeatherFetcher(null);
});

const NOW = {
  code: '200',
  now: { temp: '26', feelsLike: '26', icon: '104', text: 'Overcast', precip: '0.0', windSpeed: '16' },
};
const D3 = {
  code: '200',
  daily: [{ tempMax: '29', tempMin: '21', textDay: 'Overcast', sunrise: '05:34', sunset: '20:00' }],
};
const H24 = { code: '200', hourly: [{ pop: '20' }, { pop: '70' }, { pop: '0' }] };

function cannedFetcher(onUrl?: (u: string) => void) {
  setQWeatherFetcher(async (url) => {
    onUrl?.(url);
    if (url.includes('weather/now')) return NOW;
    if (url.includes('weather/3d')) return D3;
    if (url.includes('weather/24h')) return H24;
    throw new Error('unexpected url ' + url);
  });
}

describe('fetchQWeather (seam-injected, network-free)', () => {
  test('maps now + 3d + 24h to a WeatherSnapshot (strings → numbers)', async () => {
    cannedFetcher();
    const s = await fetchQWeather(34.37, 108.9, 'Asia/Shanghai', 'Xi’an');
    expect(s.label).toBe('Xi’an');
    expect(s.temp).toBe(26);
    expect(s.feelsLike).toBe(26);
    expect(s.condition).toBe('overcast'); // lowercased from QWeather "Overcast"
    expect(s.code).toBe(104);
    expect(s.high).toBe(29);
    expect(s.low).toBe(21);
    expect(s.precipChance).toBe(70); // max hourly pop over 24h
    expect(s.units).toBe('celsius');
    expect(typeof s.isDay).toBe('boolean');
  });

  test('builds the lon,lat location (QWeather order) at 2 decimals on the host', async () => {
    let seen = '';
    cannedFetcher((u) => {
      seen = u;
    });
    await fetchQWeather(34.37214, 108.89712, 'Asia/Shanghai', 'x');
    expect(seen).toContain('test.qweatherapi.com');
    expect(seen).toContain('location=108.90,34.37'); // longitude first, 2 decimals
    expect(seen).toContain('unit=m');
  });

  test('a non-200 now response throws (soft-fail handled upstream)', async () => {
    setQWeatherFetcher(async () => ({ code: '403' }));
    await expect(fetchQWeather(0, 0, 'UTC', 'x')).rejects.toThrow();
  });
});
