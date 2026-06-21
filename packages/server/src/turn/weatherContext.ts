// Initiative 14 (v0.21.1) — passive ambient weather. The volatile per-turn
// snapshot is formatted HERE in TS and pushed into the UNCACHED user tail (like
// the time block, temporalContext.ts); a stable, data-free WEATHER_CLAUSE rides
// the cached L1 contract. Weather changes through the day, so a per-turn weather
// string must NEVER enter the cached system block (the prompt-cache invariant).

import { resolveLocation } from './temporalContext';
import type { WeatherSnapshot } from '../tools/web/weather/openMeteo';

// Default ON since v0.21.2 (Initiative 14 close), but GATED on a configured
// location — weather is dormant (no clause, no injection) until LUNA_LAT_LON is
// set, then it just works. LUNA_WEATHER_AMBIENT=0 is the off switch.
export function weatherAmbientEnabled(): boolean {
  return Bun.env['LUNA_WEATHER_AMBIENT'] !== '0' && resolveLocation() != null;
}

// Default ON since v0.21.2; same location-gate. Governs the proactive opening
// weather note, which only fires on an after-a-night / morning wake (see
// proactiveTurn). LUNA_WEATHER_PROACTIVE=0 is the off switch.
export function weatherProactiveEnabled(): boolean {
  return Bun.env['LUNA_WEATHER_PROACTIVE'] !== '0' && resolveLocation() != null;
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

// A bounded, ignorable proactive opening note (Initiative 14, v0.21.2) — care,
// not forecast. Reads the cached snapshot (never fetches); null snapshot → no
// note. The morning / after-a-night gating lives in proactiveTurn's framing.
export function weatherNoteFor(snapshot: WeatherSnapshot | null): string | null {
  if (snapshot == null) return null;
  const u = snapshot.units === 'fahrenheit' ? '°F' : '°C';
  return (
    ` (It's ${snapshot.condition} out (${Math.round(snapshot.temp)}${u}) where Alan is — if you do ` +
    'reach out, a small weather-aware kindness can be a warm way in (note the cold, the rain, a fine ' +
    'day), but only if it feels natural, never a forecast or a status report.)'
  );
}
