import { z } from 'zod';
import { defineTool } from '../defineTool';
import { resolveLocation, resolveTz } from '../../turn/temporalContext';
import { fetchWeather } from '../web/weather/weatherProvider';
import type { WeatherUnits } from '../web/weather/openMeteo';

// weather (Initiative 14, v0.21.0) — a no-key Open-Meteo pull tool for the
// configured location (LUNA_LAT_LON). Read-only ⇒ proactiveRisk:'safe'. Location
// is configured, not sensed (IP-geolocation reports the fake-IP proxy exit node);
// an unset/bad LUNA_LAT_LON yields a recoverable err, never a throw or a brick.

function weatherUnits(): WeatherUnits {
  return Bun.env['LUNA_WEATHER_UNITS'] === 'fahrenheit' ? 'fahrenheit' : 'celsius';
}

function timeoutMs(): number {
  return Number(Bun.env['LUNA_WEATHER_TIMEOUT_MS'] ?? 10000);
}

const Input = z.object({});

const Output = z.object({
  location: z.string(),
  temp: z.number(),
  feels_like: z.number().nullable(),
  condition: z.string(),
  is_day: z.boolean(),
  precip_mm: z.number(),
  wind_kmh: z.number(),
  high: z.number(),
  low: z.number(),
  precip_chance: z.number(),
  units: z.string(),
  observed_ms: z.number().int().nonnegative(),
});

export const weatherTool = defineTool({
  name: 'weather',
  description:
    'Get the current weather for the configured location: temperature, condition, and today’s ' +
    'high / low and chance of rain. Use it when the user asks about the weather, or when it is ' +
    'naturally relevant — never to recite a forecast unprompted.',
  input: Input,
  output: Output,
  concurrency: 'safe-parallel',
  proactiveRisk: 'safe',
  timeoutMs: timeoutMs(),
  summarize: (out) =>
    `${out.location} · ${out.condition} ${Math.round(out.temp)}°, high ${Math.round(out.high)}°/low ${Math.round(out.low)}°`,
  execute: async function* (_input, ctx) {
    yield { kind: 'progress', payload: { note: '正在查天气…' } };

    if (ctx.abortSignal.aborted) {
      yield { kind: 'err', code: 'aborted', message: 'weather aborted', recoverable: true };
      return;
    }

    const loc = resolveLocation();
    if (loc == null) {
      yield {
        kind: 'err',
        code: 'execution_exception',
        message: 'location not configured — set LUNA_LAT_LON to "lat,lon"',
        recoverable: true,
      };
      return;
    }

    const label = loc.label ?? `${loc.lat},${loc.lon}`;
    try {
      const snap = await fetchWeather(loc.lat, loc.lon, resolveTz(), label, {
        signal: ctx.abortSignal,
        units: weatherUnits(),
      });
      yield {
        kind: 'ok',
        data: {
          location: snap.label,
          temp: snap.temp,
          feels_like: snap.feelsLike,
          condition: snap.condition,
          is_day: snap.isDay,
          precip_mm: snap.precipMm,
          wind_kmh: snap.windKmh,
          high: snap.high,
          low: snap.low,
          precip_chance: snap.precipChance,
          units: snap.units,
          observed_ms: snap.observedMs,
        },
      };
    } catch (e) {
      // Soft-fail discipline: a network/parse failure is a recoverable err the
      // model can describe, never a throw past the generator.
      yield {
        kind: 'err',
        code: ctx.abortSignal.aborted ? 'aborted' : 'execution_exception',
        message: e instanceof Error ? e.message : String(e),
        recoverable: true,
      };
    }
  },
});
