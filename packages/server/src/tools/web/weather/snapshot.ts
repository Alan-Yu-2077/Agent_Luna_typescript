import { resolveLocation, resolveTz } from '../../../turn/temporalContext';
import { weatherAmbientEnabled } from '../../../turn/weatherContext';
import { fetchWeather } from './weatherProvider';
import type { WeatherSnapshot, WeatherUnits } from './openMeteo';

// Background weather snapshot cache (Initiative 14, v0.21.1). Weather needs a
// network call — time did not — so the per-turn injection NEVER fetches on the
// reactive path: a .unref()'d background timer refreshes a TTL-bounded snapshot,
// and parse_input reads it SYNCHRONOUSLY. A cold/stale cache omits the block.

let lastSnapshot: WeatherSnapshot | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

function ttlMs(): number {
  const min = Number(Bun.env['LUNA_WEATHER_TTL_MIN'] ?? 30);
  return (Number.isFinite(min) && min > 0 ? min : 30) * 60_000;
}

// A snapshot older than 4× the refresh interval (default 2h) is treated as cold —
// a dead network/sidecar must not keep feeding her hours-stale weather.
function maxAgeMs(): number {
  return ttlMs() * 4;
}

function units(): WeatherUnits {
  return Bun.env['LUNA_WEATHER_UNITS'] === 'fahrenheit' ? 'fahrenheit' : 'celsius';
}

// Read the last good snapshot synchronously; null when cold or stale → the caller
// omits the weather block. Never touches the network.
export function getSnapshot(): WeatherSnapshot | null {
  if (lastSnapshot == null) return null;
  if (Date.now() - lastSnapshot.observedMs > maxAgeMs()) return null;
  return lastSnapshot;
}

// One refresh: fetch + store. Never throws — a failure keeps the last good
// snapshot (and logs), so a transient outage degrades to stale-then-omitted
// rather than crashing the background timer.
export async function refreshWeather(): Promise<void> {
  const loc = resolveLocation();
  if (loc == null) return;
  try {
    const label = loc.label ?? `${loc.lat},${loc.lon}`;
    lastSnapshot = await fetchWeather(loc.lat, loc.lon, resolveTz(), label, { units: units() });
  } catch (e) {
    console.warn('[weather] background refresh failed — keeping last snapshot:', e);
  }
}

// Boot entry (main.ts). No-op unless ambient weather is enabled AND a location is
// configured. Fires an initial refresh (fire-and-forget) + a .unref()'d interval
// so it never blocks shutdown. Idempotent.
export function startWeatherRefresh(): void {
  if (timer != null) return;
  if (!weatherAmbientEnabled() || resolveLocation() == null) return;
  void refreshWeather();
  timer = setInterval(() => void refreshWeather(), ttlMs());
  timer.unref();
}

export function setSnapshotForTests(s: WeatherSnapshot | null): void {
  lastSnapshot = s;
}

export function resetWeatherSnapshotForTests(): void {
  lastSnapshot = null;
  if (timer != null) {
    clearInterval(timer);
    timer = null;
  }
}
