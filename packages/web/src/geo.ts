// Browser GPS → server (Initiative 14, v0.21.3; live since v0.37.17). Watches the
// user's location (a one-time permission prompt), caches the newest fix, and lets
// app.ts (re)send it on every (re)connect — the server uses it as the live location
// for weather, ahead of the LUNA_LAT_LON env fallback, and it sidesteps the fake-IP
// proxy that makes server-side IP geolocation report the exit node. Requires a
// secure context (HTTPS or localhost); silently no-ops if denied/unavailable.

export type GeoFix = { lat: number; lon: number };

let lastFix: GeoFix | null = null;

export function lastGeoFix(): GeoFix | null {
  return lastFix;
}

// The desktop shell's CoreLocation push lands here so reconnects re-send the NEWEST
// fix, not the one from page load.
export function setGeoFix(fix: GeoFix): void {
  lastFix = fix;
}

// v0.37.17: watchPosition instead of a one-shot getCurrentPosition — the one-shot froze
// the location at page-load time (reconnects re-sent that snapshot forever). The browser
// announces movement itself; onFix fires on the initial fix and every real change.
export function requestGeolocation(onFix: (fix: GeoFix) => void): void {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return;
  navigator.geolocation.watchPosition(
    (pos) => {
      const fix = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      if (lastFix != null && fix.lat === lastFix.lat && fix.lon === lastFix.lon) return;
      lastFix = fix;
      onFix(fix);
    },
    (err) => {
      console.warn('[geo] geolocation unavailable:', err.message);
    },
    { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
  );
}
