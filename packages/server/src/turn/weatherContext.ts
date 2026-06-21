// Initiative 14 (v0.21.1) — passive ambient weather. The volatile per-turn
// snapshot is formatted HERE in TS and pushed into the UNCACHED user tail (like
// the time block, temporalContext.ts); a stable, data-free WEATHER_CLAUSE rides
// the cached L1 contract. Weather changes through the day, so a per-turn weather
// string must NEVER enter the cached system block (the prompt-cache invariant).

import type { WeatherSnapshot } from '../tools/web/weather/openMeteo';

// Master switch for the passive ambient weather layer. Opt-in (default off) until
// the Initiative 14 close (v0.21.2) flips it on — the time-perception pattern.
export function weatherAmbientEnabled(): boolean {
  return Bun.env['LUNA_WEATHER_AMBIENT'] === '1';
}

// Pure, synchronous, format-only — takes an already-fetched snapshot and hands
// Claude a finished, labeled fact (never asks the model to interpret raw codes).
export function buildWeatherBlock(s: WeatherSnapshot): string {
  const u = s.units === 'fahrenheit' ? '°F' : '°C';
  const t = Math.round(s.temp);
  const feels =
    s.feelsLike != null && Math.round(s.feelsLike) !== t
      ? `, feels ${Math.round(s.feelsLike)}${u}`
      : '';
  const rain = s.precipChance > 0 ? `, ${s.precipChance}% chance of rain today` : '';
  const phase = s.isDay ? 'daytime' : 'night';
  return (
    `Weather where Alan is (${s.label}): ${s.condition}, ${t}${u}${feels} — ` +
    `today's high ${Math.round(s.high)}${u} / low ${Math.round(s.low)}${u}${rain}. Currently ${phase}.`
  );
}
