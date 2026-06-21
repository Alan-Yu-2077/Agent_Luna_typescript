// Browser GPS → server (Initiative 14, v0.21.3). Requests the user's location once
// (a one-time permission prompt), caches the fix, and lets app.ts (re)send it on
// every (re)connect — the server uses it as the live location for weather, ahead
// of the LUNA_LAT_LON env fallback, and it sidesteps the fake-IP proxy that makes
// server-side IP geolocation report the exit node. Requires a secure context
// (HTTPS or localhost); silently no-ops if denied/unavailable.

export type GeoFix = { lat: number; lon: number };

let lastFix: GeoFix | null = null;

export function lastGeoFix(): GeoFix | null {
  return lastFix;
}

export function requestGeolocation(onFix: (fix: GeoFix) => void): void {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      lastFix = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      onFix(lastFix);
    },
    (err) => {
      console.warn('[geo] geolocation unavailable:', err.message);
    },
    { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
  );
}
