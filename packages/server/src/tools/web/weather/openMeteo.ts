import { z } from 'zod';
import { assertPublicUrl } from '../safeFetch';

// Open-Meteo client (Initiative 14, v0.21.0). Free, no API key, lat/lon. We do
// NOT route through safeFetch: its content-type gate rejects application/json. We
// reuse the SSRF deny-list via assertPublicUrl(), then a plain JSON GET. Source is
// a single fixed trusted host, so the rebinding-pin keystone is less critical, but
// running assertPublicUrl keeps the egress posture uniform.

export type WeatherUnits = 'celsius' | 'fahrenheit';

export type WeatherSnapshot = {
  label: string;
  temp: number;
  feelsLike: number | null;
  condition: string;
  code: number;
  isDay: boolean;
  precipMm: number;
  windKmh: number;
  high: number;
  low: number;
  precipChance: number;
  sunrise: string;
  sunset: string;
  units: WeatherUnits;
  observedMs: number;
};

// WMO weather-interpretation codes → human conditions (Open-Meteo `weather_code`).
const WMO: Record<number, string> = {
  0: 'clear',
  1: 'mainly clear',
  2: 'partly cloudy',
  3: 'overcast',
  45: 'fog',
  48: 'rime fog',
  51: 'light drizzle',
  53: 'drizzle',
  55: 'heavy drizzle',
  56: 'freezing drizzle',
  57: 'freezing drizzle',
  61: 'light rain',
  63: 'rain',
  65: 'heavy rain',
  66: 'freezing rain',
  67: 'freezing rain',
  71: 'light snow',
  73: 'snow',
  75: 'heavy snow',
  77: 'snow grains',
  80: 'light showers',
  81: 'showers',
  82: 'heavy showers',
  85: 'snow showers',
  86: 'heavy snow showers',
  95: 'thunderstorm',
  96: 'thunderstorm with hail',
  99: 'severe thunderstorm',
};

export function wmoToCondition(code: number, precipMm = 0): string {
  return WMO[code] ?? (precipMm > 0 ? 'wet' : 'unknown');
}

export function buildUrl(lat: number, lon: number, tz: string, units: WeatherUnits): string {
  const current =
    'temperature_2m,apparent_temperature,weather_code,precipitation,is_day,wind_speed_10m';
  const daily =
    'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code,sunrise,sunset';
  return (
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=${current}&daily=${daily}&timezone=${encodeURIComponent(tz)}&temperature_unit=${units}`
  );
}

const OpenMeteoResponse = z.object({
  current: z.object({
    temperature_2m: z.number(),
    apparent_temperature: z.number().optional(),
    weather_code: z.number(),
    precipitation: z.number(),
    is_day: z.number(),
    wind_speed_10m: z.number(),
  }),
  daily: z.object({
    temperature_2m_max: z.array(z.number()),
    temperature_2m_min: z.array(z.number()),
    precipitation_probability_max: z.array(z.number().nullable()),
    weather_code: z.array(z.number()),
    sunrise: z.array(z.string()),
    sunset: z.array(z.string()),
  }),
});

function mapSnapshot(json: unknown, label: string, units: WeatherUnits): WeatherSnapshot {
  const r = OpenMeteoResponse.parse(json);
  const c = r.current;
  const d = r.daily;
  return {
    label,
    temp: c.temperature_2m,
    feelsLike: c.apparent_temperature ?? null,
    condition: wmoToCondition(c.weather_code, c.precipitation),
    code: c.weather_code,
    isDay: c.is_day === 1,
    precipMm: c.precipitation,
    windKmh: c.wind_speed_10m,
    high: d.temperature_2m_max[0] ?? c.temperature_2m,
    low: d.temperature_2m_min[0] ?? c.temperature_2m,
    precipChance: d.precipitation_probability_max[0] ?? 0,
    sunrise: d.sunrise[0] ?? '',
    sunset: d.sunset[0] ?? '',
    units,
    observedMs: Date.now(),
  };
}

// Test seam (mirrors web_fetch's setWebFetcher): the client calls through this so
// a unit test injects canned Open-Meteo JSON and never touches the network/DNS.
// null restores the real path — assertPublicUrl SSRF-validate + a plain JSON GET.
type RawFetcher = (url: string, signal: AbortSignal) => Promise<unknown>;

async function defaultRawFetch(url: string, signal: AbortSignal): Promise<unknown> {
  const check = await assertPublicUrl(url);
  if (!check.ok) throw new Error(`blocked_url: ${check.reason}`);
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`fetch_failed: HTTP ${res.status}`);
  return res.json();
}

let rawFetch: RawFetcher = defaultRawFetch;

export function setWeatherFetcher(fn: RawFetcher | null): void {
  rawFetch = fn ?? defaultRawFetch;
}

export type FetchWeatherOpts = { signal?: AbortSignal; units?: WeatherUnits };

export async function fetchOpenMeteo(
  lat: number,
  lon: number,
  tz: string,
  label: string,
  opts: FetchWeatherOpts = {},
): Promise<WeatherSnapshot> {
  const units = opts.units ?? 'celsius';
  const signal = opts.signal ?? new AbortController().signal;
  const json = await rawFetch(buildUrl(lat, lon, tz, units), signal);
  return mapSnapshot(json, label, units);
}
