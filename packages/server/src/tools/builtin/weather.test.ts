import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { weatherTool } from './weather';
import { setWeatherFetcher } from '../web/weather/openMeteo';
import {
  clearRuntimeLocationForTests,
  resolveLocation,
  setRuntimeLocation,
} from '../../turn/temporalContext';

const ENV_KEYS = ['LUNA_LAT_LON', 'LUNA_WEATHER_LOCATION', 'LUNA_WEATHER_UNITS'];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = Bun.env[k];
  clearRuntimeLocationForTests();
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete Bun.env[k];
    else Bun.env[k] = saved[k];
  }
  setWeatherFetcher(null);
  clearRuntimeLocationForTests();
});

const ctx = () => ({ sessionId: 'test', callId: 'c1', abortSignal: new AbortController().signal });

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

type Ev = {
  kind: string;
  code?: string;
  message?: string;
  recoverable?: boolean;
  data?: Record<string, unknown>;
};

async function run(input: unknown, c = ctx()): Promise<Ev[]> {
  const events: Ev[] = [];
  for await (const e of weatherTool.execute(input, c)) events.push(e as Ev);
  return events;
}

describe('weather tool', () => {
  test('configured location → progress then ok with typed fields', async () => {
    Bun.env['LUNA_LAT_LON'] = '31.23,121.47';
    Bun.env['LUNA_WEATHER_LOCATION'] = 'Shanghai';
    setWeatherFetcher(async () => CANNED);
    const events = await run({});
    expect(events[0]?.kind).toBe('progress');
    const ok = events.find((e) => e.kind === 'ok');
    expect(ok).toBeDefined();
    expect(ok?.data?.['location']).toBe('Shanghai');
    expect(ok?.data?.['condition']).toBe('overcast');
    expect(typeof ok?.data?.['temp']).toBe('number');
    expect(ok?.data?.['units']).toBe('celsius');
    expect(weatherTool.summarize(ok?.data)).toContain('Shanghai');
  });

  test('unset LUNA_LAT_LON → recoverable err, not a throw', async () => {
    delete Bun.env['LUNA_LAT_LON'];
    const events = await run({});
    const err = events.find((e) => e.kind === 'err');
    expect(err).toBeDefined();
    expect(err?.recoverable).toBe(true);
    expect(err?.message).toContain('LUNA_LAT_LON');
  });

  test('aborted ctx → aborted err', async () => {
    Bun.env['LUNA_LAT_LON'] = '31.23,121.47';
    const ac = new AbortController();
    ac.abort();
    const events = await run({}, { sessionId: 't', callId: 'c', abortSignal: ac.signal });
    const err = events.find((e) => e.kind === 'err');
    expect(err?.code).toBe('aborted');
  });
});

describe('resolveLocation', () => {
  test('valid "lat,lon" parses (whitespace-tolerant)', () => {
    Bun.env['LUNA_LAT_LON'] = ' 31.23 , 121.47 ';
    expect(resolveLocation()).toEqual({ lat: 31.23, lon: 121.47 });
  });

  test('label attaches when LUNA_WEATHER_LOCATION is set', () => {
    Bun.env['LUNA_LAT_LON'] = '0,0';
    Bun.env['LUNA_WEATHER_LOCATION'] = 'Null Island';
    expect(resolveLocation()?.label).toBe('Null Island');
  });

  test('unset / garbage / out-of-range → null', () => {
    delete Bun.env['LUNA_LAT_LON'];
    expect(resolveLocation()).toBeNull();
    Bun.env['LUNA_LAT_LON'] = 'nonsense';
    expect(resolveLocation()).toBeNull();
    Bun.env['LUNA_LAT_LON'] = '200,0';
    expect(resolveLocation()).toBeNull();
  });

  test('runtime GPS (client.geo) takes precedence over LUNA_LAT_LON', () => {
    Bun.env['LUNA_LAT_LON'] = '31.23,121.47';
    setRuntimeLocation(40, -74);
    expect(resolveLocation()).toMatchObject({ lat: 40, lon: -74 });
    clearRuntimeLocationForTests();
    expect(resolveLocation()).toEqual({ lat: 31.23, lon: 121.47 }); // falls back to env
  });
});
