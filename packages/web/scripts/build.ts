// v0.38.1: the web production build, in portable Bun/node:fs instead of a shell one-liner. The old
// `rm -rf dist && … && cp … && mkdir -p … && cp -R …/. … 2>/dev/null || true` ran fine under a POSIX
// shell but not under cmd.exe, and its behavior under Bun Shell on Windows was unverified. This does
// the same three steps — clean, bundle, stage assets — with the same optional-models semantics, and
// runs identically on every OS the CI matrix covers.
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { stageWebAssets } from './stageAssets';

const root = join(import.meta.dir, '..');
const dist = join(root, 'dist');
const publicDir = join(root, 'public');

// 1. clean
rmSync(dist, { recursive: true, force: true });

// 2. bundle (bun's html-entrypoint bundler — same flags as before)
const bundle = spawnSync('bun', ['build', './index.html', '--production', '--outdir=dist'], {
  cwd: root,
  stdio: 'inherit',
});
if (bundle.status !== 0) process.exit(bundle.status ?? 1);

// 3. stage runtime assets (cubism core required, models tree optional)
stageWebAssets(publicDir, dist);
