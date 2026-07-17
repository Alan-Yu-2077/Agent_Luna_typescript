import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { resolveBootMode, resolveDevLauncher, resolveSidecarDb, shouldAttach } from './backend';

const SHARED = '/repo/luna.sqlite';
const USER = '/userData/luna.sqlite';

describe('resolveSidecarDb (v0.28.8)', () => {
  test('uses the shared repo DB when it exists and not in smoke', () => {
    const db = resolveSidecarDb({ sharedDb: SHARED, userDb: USER, smoke: false, exists: () => true });
    expect(db).toBe(SHARED);
  });

  test('falls back to the app-data DB when the shared path is absent', () => {
    const db = resolveSidecarDb({ sharedDb: SHARED, userDb: USER, smoke: false, exists: () => false });
    expect(db).toBe(USER);
  });

  test('never touches the real DB under SMOKE, even when the shared path exists', () => {
    const db = resolveSidecarDb({ sharedDb: SHARED, userDb: USER, smoke: true, exists: () => true });
    expect(db).toBe(USER);
  });
});

describe('shouldAttach (v0.28.8)', () => {
  test('attaches when a backend is already listening', () => {
    expect(shouldAttach({ portListening: true, smoke: false })).toBe(true);
  });

  test('spawns its own when nothing is listening', () => {
    expect(shouldAttach({ portListening: false, smoke: false })).toBe(false);
  });

  test('SMOKE never attaches (deterministic + isolated), even if a port is up', () => {
    expect(shouldAttach({ portListening: true, smoke: true })).toBe(false);
  });
});

describe('resolveDevLauncher (v0.28.9)', () => {
  const REPO = '/repo';
  // join() so the fixture matches what resolveDevLauncher builds on the running OS (backslashes on
  // win32) — a hardcoded '/repo/scripts/...' never matched the code's join() output on Windows.
  const SCRIPT = join(REPO, 'scripts', 'dev-all.ts');

  test('returns bun + dev-all script + repo cwd when both are present', () => {
    const r = resolveDevLauncher({
      repoRoot: REPO,
      env: { HOME: '/home/a' },
      exists: (p) => p === SCRIPT || p === '/opt/homebrew/bin/bun',
    });
    expect(r).toEqual({ bun: '/opt/homebrew/bin/bun', script: SCRIPT, cwd: REPO });
  });

  test('null when not a source checkout (dev-all.ts absent) → caller uses the compiled sidecar', () => {
    const r = resolveDevLauncher({ repoRoot: REPO, env: {}, exists: () => false });
    expect(r).toBeNull();
  });

  test('null when no bun binary is reachable, even in a checkout', () => {
    const r = resolveDevLauncher({ repoRoot: REPO, env: { HOME: '/home/a' }, exists: (p) => p === SCRIPT });
    expect(r).toBeNull();
  });

  test('LUNA_BUN_PATH override wins over the default locations', () => {
    const r = resolveDevLauncher({
      repoRoot: REPO,
      env: { LUNA_BUN_PATH: '/custom/bun', HOME: '/home/a' },
      exists: (p) => p === SCRIPT || p === '/custom/bun',
    });
    expect(r?.bun).toBe('/custom/bun');
  });

  // v0.38.0: win32 has no HOME (USERPROFILE is the real one) and bun installs as bun.exe.
  test('win32: USERPROFILE + bun.exe under .bun\\bin is found', () => {
    const bunExe = join('/users/a', '.bun', 'bin', 'bun.exe');
    const r = resolveDevLauncher({
      repoRoot: REPO,
      env: { USERPROFILE: '/users/a' },
      exists: (p) => p === SCRIPT || p === bunExe,
    });
    expect(r?.bun).toBe(bunExe);
  });

  test('HOME still takes precedence over USERPROFILE when both are set', () => {
    const homeBun = join('/home/a', '.bun', 'bin', 'bun');
    const r = resolveDevLauncher({
      repoRoot: REPO,
      env: { HOME: '/home/a', USERPROFILE: '/users/a' },
      exists: (p) => p === SCRIPT || p === homeBun,
    });
    expect(r?.bun).toBe(homeBun);
  });
});

describe('resolveBootMode (v0.35.5)', () => {
  const base = { attached: false, needsOnboarding: false, smoke: false, skipOnboarding: false, devAvailable: false };

  test('THE regression: fresh machine WITH a checkout (every `bun run app` user) → setup, not dev', () => {
    expect(resolveBootMode({ ...base, needsOnboarding: true, devAvailable: true })).toBe('setup');
  });

  test('attach wins over everything — a running backend already holds the keys', () => {
    expect(resolveBootMode({ ...base, attached: true, needsOnboarding: true, devAvailable: true })).toBe('attach');
  });

  test('keys present + checkout → dev; keys present, no checkout → sidecar', () => {
    expect(resolveBootMode({ ...base, devAvailable: true })).toBe('dev');
    expect(resolveBootMode(base)).toBe('sidecar');
  });

  test('LUNA_SKIP_ONBOARDING bypasses setup (falls through to dev/sidecar)', () => {
    expect(resolveBootMode({ ...base, needsOnboarding: true, skipOnboarding: true, devAvailable: true })).toBe('dev');
    expect(resolveBootMode({ ...base, needsOnboarding: true, skipOnboarding: true })).toBe('sidecar');
  });

  test('smoke suppresses setup — the probe needs a window, never the form', () => {
    expect(resolveBootMode({ ...base, needsOnboarding: true, smoke: true })).toBe('sidecar');
  });
});
