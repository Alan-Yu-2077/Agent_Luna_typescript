// One-command build-and-run for the desktop app: `bun run app`.
//
// First run installs deps; then it rebuilds the web bundle + server binary + packages the desktop app
// with electron-builder — but ONLY when a build input changed since the last package (otherwise it
// launches the existing app instantly). So "clone → `bun run app`" just works, and after a code change
// the same command re-packages automatically; nothing changed → instant launch.
//
// Voice is bring-your-own: this never spawns GPT-SoVITS. If LUNA_TTS_BACKEND=http and nothing is
// listening on the api_v2 port, it prints a one-line reminder (see docs/SETUP.md).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');

// v0.38.2: `bun run app --win` cross-builds the Windows package FROM the mac (electron-builder runs
// NSIS on macOS, no wine needed for the app itself). Delivery to the test PC is manual (the built
// installer path is printed) — no ditto, no launch.
const WIN = process.argv.includes('--win');

// The delivered, double-clickable app lands on the user's Desktop (override the folder with
// LUNA_APP_DEST). packages/desktop/release/… stays the build cache; this is the copy people launch.
const DEST_DIR = process.env['LUNA_APP_DEST'] ?? join(homedir(), 'Desktop');
const DEST_APP = join(DEST_DIR, 'Luna.app');

function run(cmd: string[], cwd = ROOT): void {
  const r = spawnSync(cmd[0]!, cmd.slice(1), { cwd, stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(`\n[app] step failed (exit ${r.status}): ${cmd.join(' ')}`);
    process.exit(r.status ?? 1);
  }
}

// Build inputs that, when newer than the packaged app, force a re-package. Deliberately NOT the whole
// repo — docs / tests / .env / the DB don't change the shipped bundle.
const SOURCE_PATHS = [
  'packages/protocol/src',
  'packages/server/src',
  'packages/web/src',
  'packages/web/public',
  'packages/web/index.html',
  'packages/desktop/src',
  'scripts',
  'package.json',
  'bun.lock',
  'packages/protocol/package.json',
  'packages/server/package.json',
  'packages/web/package.json',
  'packages/desktop/package.json',
];
const SKIP_DIRS = new Set(['node_modules', 'dist', 'release', 'bin', '.git']);

function newestMtime(path: string): number {
  if (!existsSync(path)) return 0;
  const st = statSync(path);
  if (!st.isDirectory()) return st.mtimeMs;
  let newest = st.mtimeMs;
  for (const e of readdirSync(path, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name) || e.name.includes('.sqlite')) continue;
    newest = Math.max(newest, newestMtime(join(path, e.name)));
  }
  return newest;
}

// electron-builder --dir writes release/<platform>-<arch>/Luna.app (mac) — find whichever exists.
function findApp(): string | null {
  const releaseDir = join(ROOT, 'packages/desktop/release');
  if (!existsSync(releaseDir)) return null;
  for (const d of readdirSync(releaseDir)) {
    const app = join(releaseDir, d, 'Luna.app');
    if (existsSync(app)) return app;
  }
  return null;
}

async function warnIfVoiceDown(): Promise<void> {
  if (process.env['LUNA_TTS_BACKEND'] !== 'http') return;
  const url = process.env['LUNA_TTS_URL'] ?? 'http://127.0.0.1:9880';
  try {
    await fetch(url, { signal: AbortSignal.timeout(1200) });
  } catch {
    console.log(`[app] note: LUNA_TTS_BACKEND=http but ${url} is unreachable — start your GPT-SoVITS`);
    console.log('[app]       api_v2 for voice (see docs/SETUP.md), or set LUNA_TTS_BACKEND=browser.');
  }
}

if (!existsSync(join(ROOT, 'node_modules'))) {
  console.log('[app] installing dependencies…');
  run(['bun', 'install']);
}

if (WIN) {
  console.log('[app] cross-building the Windows package (web + luna-server.exe + NSIS installer)…');
  run(['bun', 'run', '--cwd', 'packages/web', 'build']);
  run(['bun', 'run', '--cwd', 'packages/desktop', 'compile:server:win']);
  run(['bun', 'run', '--cwd', 'packages/desktop', 'pack:win']);
  const rel = join(ROOT, 'packages/desktop/release');
  const installer = existsSync(rel) ? readdirSync(rel).find((f) => /^Luna Setup .*\.exe$/.test(f)) : undefined;
  if (installer) console.log(`[app] Windows installer built → ${join(rel, installer)}`);
  else console.log(`[app] win-unpacked built at ${join(rel, 'win-unpacked')} (no NSIS installer found — check output above)`);
  console.log('[app] deliver it to the x64 PC (GitHub Release / USB) and run it there.');
  process.exit(0);
}

const cached = findApp();
const srcMtime = Math.max(...SOURCE_PATHS.map((p) => newestMtime(join(ROOT, p))));
const needBuild = cached === null || statSync(cached).mtimeMs < srcMtime;

if (needBuild) {
  console.log('[app] building web + server + packaging the desktop app…');
  run(['bun', 'run', '--cwd', 'packages/web', 'build']);
  run(['bun', 'run', '--cwd', 'packages/desktop', 'compile:server']);
  run(['bun', 'run', '--cwd', 'packages/desktop', 'pack']);
} else {
  console.log('[app] packaged app is up to date (edit source, re-run to re-package)');
}

const built = findApp();
if (!built) {
  console.error('[app] no Luna.app was produced — check the electron-builder output above.');
  process.exit(1);
}

await warnIfVoiceDown();

if (process.platform !== 'darwin') {
  console.log(`[app] built at: ${built} — open it for your platform (electron-builder --dir output).`);
  process.exit(0);
}

// Deliver a real, double-clickable copy to the Desktop — it survives the repo being moved or deleted.
// Refresh it only when the freshly built app is newer. `ditto` is the bundle-correct copy on macOS.
const delivered = existsSync(DEST_APP) && statSync(DEST_APP).mtimeMs >= statSync(built).mtimeMs;
if (delivered) {
  console.log(`[app] Luna.app already on your Desktop → ${DEST_APP}`);
} else {
  console.log(`[app] placing Luna.app on your Desktop → ${DEST_APP}`);
  mkdirSync(DEST_DIR, { recursive: true });
  run(['/bin/rm', '-rf', DEST_APP]);
  run(['/usr/bin/ditto', built, DEST_APP]);
  run(['/usr/bin/touch', DEST_APP]);
}

if (process.env['LUNA_APP_NO_LAUNCH']) {
  console.log(`[app] delivered (LUNA_APP_NO_LAUNCH set, not launching): ${DEST_APP}`);
} else {
  console.log(`[app] launching ${DEST_APP}`);
  run(['open', DEST_APP]);
}
