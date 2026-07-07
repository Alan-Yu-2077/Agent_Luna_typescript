import { execFileSync } from 'node:child_process';

// Desktop-native location acquisition (v0.33.0). The desktop webview has no browser GPS, so weather
// needs LUNA_LAT_LON present at the sidecar's boot (the weather tool mount is boot-frozen). This
// resolves a location from the Mac itself, best-first:
//   1. a manual luna.env LUNA_LAT_LON — always respected, never overridden (the operator's word)
//   2. CoreLocationCLI — accurate, but needs the Homebrew tool + macOS Location Services granted
//   3. the system timezone → a representative city — coarse, but zero-permission, offline and
//      VPN-proof, so desktop weather is never fully dark
// Only an accurate (CoreLocation) fix is persisted back to luna.env; the timezone fallback stays
// ephemeral so a later CoreLocation grant auto-upgrades it.

export type LatLon = { lat: number; lon: number };
export type LocationSource = 'corelocation' | 'timezone';
export type LocationFix = { lat: number; lon: number; source: LocationSource; persist: boolean };

const COORD_RE = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;
const CLI_PATHS = ['/opt/homebrew/bin/CoreLocationCLI', '/usr/local/bin/CoreLocationCLI'];
const CLI_TIMEOUT_MS = 3000;

function inRange(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180 &&
    !(lat === 0 && lon === 0) // reject the 0,0 null-island a degraded fix collapses to
  );
}

export function parseLatLon(raw: string): LatLon | null {
  const m = COORD_RE.exec(raw.trim());
  if (!m) return null; // CoreLocationCLI's "❌ … denied" line lands here → null
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  return inRange(lat, lon) ? { lat, lon } : null;
}

type Exec = (file: string, args: string[]) => string;
const defaultExec: Exec = (file, args) =>
  execFileSync(file, args, { timeout: CLI_TIMEOUT_MS, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

export function coreLocationFix(
  opts: { platform?: string; exec?: Exec; cliPaths?: string[] } = {},
): LatLon | null {
  if ((opts.platform ?? process.platform) !== 'darwin') return null;
  const exec = opts.exec ?? defaultExec;
  for (const p of opts.cliPaths ?? CLI_PATHS) {
    try {
      const fix = parseLatLon(exec(p, ['--format', '%latitude,%longitude']));
      if (fix) return fix;
    } catch {
      // ENOENT (tool not at this path) / non-zero exit (denied) / timeout → try the next path
    }
  }
  return null;
}

// Curated IANA zone → representative city coords. Coarse by design (region-level); extend freely.
export const TZ_TO_LATLON: Record<string, LatLon> = {
  'Asia/Shanghai': { lat: 31.23, lon: 121.47 },
  'Asia/Chongqing': { lat: 29.56, lon: 106.55 },
  'Asia/Urumqi': { lat: 43.83, lon: 87.62 },
  'Asia/Hong_Kong': { lat: 22.32, lon: 114.17 },
  'Asia/Macau': { lat: 22.2, lon: 113.55 },
  'Asia/Taipei': { lat: 25.03, lon: 121.57 },
  'Asia/Tokyo': { lat: 35.68, lon: 139.69 },
  'Asia/Seoul': { lat: 37.57, lon: 126.98 },
  'Asia/Singapore': { lat: 1.35, lon: 103.82 },
  'Asia/Kuala_Lumpur': { lat: 3.14, lon: 101.69 },
  'Asia/Bangkok': { lat: 13.76, lon: 100.5 },
  'Asia/Jakarta': { lat: -6.21, lon: 106.85 },
  'Asia/Manila': { lat: 14.6, lon: 120.98 },
  'Asia/Ho_Chi_Minh': { lat: 10.82, lon: 106.63 },
  'Asia/Kolkata': { lat: 22.57, lon: 88.36 },
  'Asia/Dhaka': { lat: 23.81, lon: 90.41 },
  'Asia/Karachi': { lat: 24.86, lon: 67.0 },
  'Asia/Dubai': { lat: 25.2, lon: 55.27 },
  'Asia/Tehran': { lat: 35.69, lon: 51.39 },
  'Asia/Jerusalem': { lat: 31.77, lon: 35.21 },
  'Asia/Istanbul': { lat: 41.01, lon: 28.98 },
  'Europe/Istanbul': { lat: 41.01, lon: 28.98 },
  'Europe/London': { lat: 51.51, lon: -0.13 },
  'Europe/Dublin': { lat: 53.35, lon: -6.26 },
  'Europe/Paris': { lat: 48.86, lon: 2.35 },
  'Europe/Madrid': { lat: 40.42, lon: -3.7 },
  'Europe/Berlin': { lat: 52.52, lon: 13.4 },
  'Europe/Amsterdam': { lat: 52.37, lon: 4.9 },
  'Europe/Rome': { lat: 41.9, lon: 12.5 },
  'Europe/Zurich': { lat: 47.38, lon: 8.54 },
  'Europe/Stockholm': { lat: 59.33, lon: 18.07 },
  'Europe/Moscow': { lat: 55.76, lon: 37.62 },
  'Australia/Sydney': { lat: -33.87, lon: 151.21 },
  'Australia/Melbourne': { lat: -37.81, lon: 144.96 },
  'Australia/Perth': { lat: -31.95, lon: 115.86 },
  'Pacific/Auckland': { lat: -36.85, lon: 174.76 },
  'America/New_York': { lat: 40.71, lon: -74.01 },
  'America/Toronto': { lat: 43.65, lon: -79.38 },
  'America/Chicago': { lat: 41.88, lon: -87.63 },
  'America/Denver': { lat: 39.74, lon: -104.99 },
  'America/Los_Angeles': { lat: 34.05, lon: -118.24 },
  'America/Vancouver': { lat: 49.28, lon: -123.12 },
  'America/Mexico_City': { lat: 19.43, lon: -99.13 },
  'America/Sao_Paulo': { lat: -23.55, lon: -46.63 },
  'America/Bogota': { lat: 4.71, lon: -74.07 },
  'America/Argentina/Buenos_Aires': { lat: -34.6, lon: -58.38 },
  'Africa/Cairo': { lat: 30.04, lon: 31.24 },
  'Africa/Johannesburg': { lat: -26.2, lon: 28.05 },
  'Africa/Lagos': { lat: 6.52, lon: 3.38 },
};

export function timezoneFix(tz: string | undefined): LatLon | null {
  if (tz == null) return null;
  return TZ_TO_LATLON[tz] ?? null;
}

function systemTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

// The desktop location chain. Returns null when there is nothing to inject — either the operator
// already pinned LUNA_LAT_LON (respected) or no source produced a usable fix.
export function resolveDesktopLocation(
  userEnv: Record<string, string>,
  opts: { platform?: string; exec?: Exec; tz?: string } = {},
): LocationFix | null {
  const manual = userEnv['LUNA_LAT_LON'];
  if (manual != null && parseLatLon(manual) != null) return null; // operator's word is final
  const cl = coreLocationFix({ platform: opts.platform, exec: opts.exec });
  if (cl) return { ...cl, source: 'corelocation', persist: true };
  const tz = timezoneFix(opts.tz ?? systemTimezone());
  if (tz) return { ...tz, source: 'timezone', persist: false };
  return null;
}

export function formatLatLon(fix: LatLon): string {
  return `${fix.lat},${fix.lon}`;
}
