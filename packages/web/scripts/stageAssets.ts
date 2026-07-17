import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// v0.38.1: stage the runtime assets into an already-bundled dist — the cubism core (required) plus
// the models tree (optional, so a fresh checkout without bundled models still builds, matching the
// old `2>/dev/null || true`). Pure of the bundler so it is unit-testable against a temp dir; fs
// injectable for the same reason. Idempotent: re-running over a populated dist just re-copies.
export type StageFs = {
  exists: (p: string) => boolean;
  mkdirp: (p: string) => void;
  copyFile: (from: string, to: string) => void;
  copyDir: (from: string, to: string) => void;
};

const realFs: StageFs = {
  exists: (p) => existsSync(p),
  mkdirp: (p) => mkdirSync(p, { recursive: true }),
  copyFile: (from, to) => cpSync(from, to),
  copyDir: (from, to) => cpSync(from, to, { recursive: true }),
};

export function stageWebAssets(publicDir: string, distDir: string, fs: StageFs = realFs): void {
  fs.mkdirp(distDir);
  fs.copyFile(join(publicDir, 'live2dcubismcore.min.js'), join(distDir, 'live2dcubismcore.min.js'));
  const models = join(publicDir, 'models');
  if (fs.exists(models)) fs.copyDir(models, join(distDir, 'models'));
}
