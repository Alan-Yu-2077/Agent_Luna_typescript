import { existsSync } from 'node:fs';
import { join } from 'node:path';

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

// v0.35.5: the boot-mode decision, pure. Precedence: attach (a running backend owns the keys) →
// SETUP (no key yet — the wizard must come BEFORE the dev launcher, or every `bun run app` user
// boots straight into a keyless dev stack and never sees onboarding; the v0.35.4 default flip made
// that hole user-visible) → dev launcher → self-contained sidecar. Smoke suppresses setup (the
// probe needs the app window); its caller already suppresses dev under smoke.
export type BootMode = 'attach' | 'setup' | 'dev' | 'sidecar';
export function resolveBootMode(o: {
  attached: boolean;
  needsOnboarding: boolean;
  smoke: boolean;
  skipOnboarding: boolean;
  devAvailable: boolean;
}): BootMode {
  if (o.attached) return 'attach';
  if (o.needsOnboarding && !o.smoke && !o.skipOnboarding) return 'setup';
  if (o.devAvailable) return 'dev';
  return 'sidecar';
}

// v0.28.9 — when the app has to start the backend itself, prefer launching the WHOLE dev stack
// (`bun scripts/dev-all.ts` = server 8787 + web 5173 + tts 8788) so one click brings everything up
// and the browser can share the same Luna. Needs a source checkout (dev-all.ts present) + a bun
// binary reachable by ABSOLUTE path — a Finder-launched .app has a minimal PATH, so `bun` alone
// ENOENTs; probe the common install locations (+ a LUNA_BUN_PATH override). Returns null when this
// isn't a dev machine, so the caller falls back to the self-contained compiled sidecar.
export function resolveDevLauncher(opts: {
  repoRoot: string;
  env: Record<string, string | undefined>;
  exists?: (p: string) => boolean;
}): { bun: string; script: string; cwd: string } | null {
  const exists = opts.exists ?? existsSync;
  const script = join(opts.repoRoot, 'scripts', 'dev-all.ts');
  if (!exists(script)) return null;
  // v0.38.0: HOME is normally unset on win32 (USERPROFILE is the real one), and bun installs as
  // bun.exe there — without these a dev-checkout Windows machine silently skipped the dev launcher.
  const home = opts.env['HOME'] ?? opts.env['USERPROFILE'] ?? '';
  const candidates = [
    opts.env['LUNA_BUN_PATH'],
    '/opt/homebrew/bin/bun',
    '/usr/local/bin/bun',
    home ? join(home, '.bun', 'bin', 'bun') : undefined,
    home ? join(home, '.bun', 'bin', 'bun.exe') : undefined,
  ].filter((c): c is string => typeof c === 'string' && c.length > 0);
  const bun = candidates.find((c) => exists(c));
  return bun ? { bun, script, cwd: opts.repoRoot } : null;
}
