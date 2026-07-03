import { existsSync } from 'node:fs';

// v0.28.8 — unify the desktop app with the web backend: one Luna, one DB, one brain. The app and
// `bun run dev` are the same person, not two divergent copies. Pure + injectable so main.ts's
// electron-coupled boot can stay untested while this decision logic is covered.

// The DB the spawned sidecar should open. Points at the SHARED repo DB so the desktop window and the
// browser tab read/write the same memory. Falls back to the app-data DB when the shared path doesn't
// exist (a distributed build on another machine) or under SMOKE — the packaged smoke must stay
// self-contained AND must never write the real Luna's DB.
export function resolveSidecarDb(opts: {
  sharedDb: string;
  userDb: string;
  smoke: boolean;
  exists?: (p: string) => boolean;
}): string {
  const exists = opts.exists ?? existsSync;
  return !opts.smoke && exists(opts.sharedDb) ? opts.sharedDb : opts.userDb;
}

// Whether to ATTACH to an already-running backend instead of spawning our own. When a server is
// already listening on the canonical port (typically `bun run dev`), the app becomes just another
// client of that one Luna — no second sidecar, no second DB, no onboarding. SMOKE always spawns
// (a verification run must be deterministic + isolated).
export function shouldAttach(opts: { portListening: boolean; smoke: boolean }): boolean {
  return opts.portListening && !opts.smoke;
}
