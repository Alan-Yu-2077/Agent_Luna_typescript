import { z } from 'zod';
import { assertPublicUrl } from '../safeFetch';
import type { WeatherSnapshot, WeatherUnits } from './openMeteo';

// QWeather (和风天气) provider (Initiative 14, v0.21.5). China-accurate (CMA-based),
// unlike Open-Meteo's global model. Needs a free key + the account's custom API Host
// (LUNA_WEATHER_API_KEY / LUNA_WEATHER_API_HOST — the post-2024 per-account host, e.g.
// xxxx.qweatherapi.com; the legacy devapi/api hosts return "Invalid Host"). Every
// numeric field comes back as a STRING, so all are Number()'d.

function host(): string {
  const h = Bun.env['LUNA_WEATHER_API_HOST'];
  if (h == null || h.trim().length === 0) throw new Error('LUNA_WEATHER_API_HOST not set');
  return h.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
}
function apiKey(): string {
  const k = Bun.env['LUNA_WEATHER_API_KEY'];
  if (k == null || k.length === 0) throw new Error('LUNA_WEATHER_API_KEY not set');
  return k;
}
function qwUrl(path: string, location: string, units: WeatherUnits): string {
  const unit = units === 'fahrenheit' ? 'i' : 'm';
  return `https://${host()}/v7/${path}?location=${location}&key=${apiKey()}&lang=en&unit=${unit}`;
}

// Test seam: inject canned QWeather JSON keyed off the URL path; null restores the
// real path — assertPublicUrl SSRF-validate + a plain JSON GET.
type QwFetcher = (url: string, signal?: AbortSignal) => Promise<unknown>;
async function defaultQwFetch(url: string, signal?: AbortSignal): Promise<unknown> {
  const check = await assertPublicUrl(url);
  if (!check.ok) throw new Error(`blocked_url: ${check.reason}`);
  const res = await fetch(url, signal ? { signal } : {});
  if (!res.ok) throw new Error(`fetch_failed: HTTP ${res.status}`);
  return res.json();
}
let qwFetch: QwFetcher = defaultQwFetch;
export function setQWeatherFetcher(fn: QwFetcher | null): void {
  qwFetch = fn ?? defaultQwFetch;
}

const NowResp = z.object({
  code: z.string(),
  now: z
    .object({
      temp: z.string(),
      feelsLike: z.string(),
      icon: z.string(),
      text: z.string(),
      precip: z.string(),
      windSpeed: z.string(),
    })
    .optional(),
});
const DailyResp = z.object({
  code: z.string(),
  daily: z
    .array(
      z.object({
        tempMax: z.string(),
        tempMin: z.string(),
        textDay: z.string(),
        sunrise: z.string().optional(),
        sunset: z.string().optional(),
      }),
    )
    .optional(),
});
const HourlyResp = z.object({
  code: z.string(),
  hourly: z.array(z.object({ pop: z.string().optional() })).optional(),
});

function localHHMM(tz: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
}

export async function fetchQWeather(
  lat: number,
  lon: number,
  tz: string,
  label: string,
  opts: { units?: WeatherUnits; signal?: AbortSignal } = {},
): Promise<WeatherSnapshot> {
  const units = opts.units ?? 'celsius';
  // QWeather location is "longitude,latitude" (lon first), ≤2 decimals.
  const loc = `${lon.toFixed(2)},${lat.toFixed(2)}`;

  const now = NowResp.parse(await qwFetch(qwUrl('weather/now', loc, units), opts.signal));
  if (now.code !== '200' || !now.now) throw new Error(`qweather now: code ${now.code}`);
  const n = now.now;

  const dRes = DailyResp.parse(await qwFetch(qwUrl('weather/3d', loc, units), opts.signal));
  const day = dRes.code === '200' ? dRes.daily?.[0] : undefined;

  // Chance of rain = max hourly probability over the next 24h (best-effort).
  let precipChance = 0;
  try {
    const h = HourlyResp.parse(await qwFetch(qwUrl('weather/24h', loc, units), opts.signal));
    if (h.code === '200' && h.hourly && h.hourly.length > 0) {
      precipChance = Math.max(0, ...h.hourly.map((x) => Number(x.pop ?? 0)));
    }
  } catch {
    // pop is non-essential; leave at 0 if the hourly call fails
  }

  const sunrise = day?.sunrise ?? '';
  const sunset = day?.sunset ?? '';
  const hhmm = localHHMM(tz);
  const isDay = sunrise.length > 0 && sunset.length > 0 ? sunrise <= hhmm && hhmm < sunset : true;

  return {
    label,
    temp: Number(n.temp),
    feelsLike: Number(n.feelsLike),
    condition: n.text.toLowerCase(),
    code: Number(n.icon),
    isDay,
    precipMm: Number(n.precip),
    windKmh: Number(n.windSpeed),
    high: day ? Number(day.tempMax) : Number(n.temp),
    low: day ? Number(day.tempMin) : Number(n.temp),
    precipChance,
    sunrise,
    sunset,
    units,
    observedMs: Date.now(),
  };
}
