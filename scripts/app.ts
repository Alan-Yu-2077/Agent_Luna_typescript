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
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');

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

const existing = findApp();
const srcMtime = Math.max(...SOURCE_PATHS.map((p) => newestMtime(join(ROOT, p))));
const fresh = existing !== null && statSync(existing).mtimeMs >= srcMtime;

if (fresh) {
  console.log('[app] packaged app is up to date — launching (edit source, re-run to re-package)');
} else {
  console.log('[app] building web + server + packaging the desktop app…');
  run(['bun', 'run', '--cwd', 'packages/web', 'build']);
  run(['bun', 'run', '--cwd', 'packages/desktop', 'compile:server']);
  run(['bun', 'run', '--cwd', 'packages/desktop', 'pack']);
}

const app = findApp();
if (!app) {
  console.error('[app] no Luna.app was produced — check the electron-builder output above.');
  process.exit(1);
}

await warnIfVoiceDown();

if (process.env['LUNA_APP_NO_LAUNCH']) {
  console.log(`[app] built (LUNA_APP_NO_LAUNCH set, not launching): ${app}`);
} else if (process.platform === 'darwin') {
  console.log(`[app] launching ${app}`);
  run(['open', app]);
} else {
  console.log(`[app] built at: ${app} — open it for your platform (electron-builder --dir output).`);
}
