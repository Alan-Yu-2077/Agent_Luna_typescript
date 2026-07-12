// v0.35.2 (Initiative 25): the Live2D model install core, extracted from the v0.34.7 picker so the
// wizard's drag-and-drop and the native "Choose model folder…" dialog share ONE validated path.
// Electron-free (plain fs) so it unit-tests in temp dirs. Copy-only by contract: the source folder
// is never moved, deleted, or executed from.

import { cpSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { mergeEnvFile } from './onboarding';

export type ModelInstallResult = { ok: boolean; modelUrl?: string; error?: string };

// The dropped folder is the model dir when it holds a *.model3.json — or a WRAPPER when the model
// sits one level down (the near-universal unzip shape: `puppy/puppy/puppy.model3.json`). One level
// only; deeper nesting is ambiguous and should fail loudly rather than guess.
export function resolveModelDir(src: string): { dir: string; manifest: string } | null {
  const direct = readdirSync(src).find((f) => f.endsWith('.model3.json'));
  if (direct) return { dir: src, manifest: direct };
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const child = join(src, entry.name);
    const manifest = readdirSync(child).find((f) => f.endsWith('.model3.json'));
    if (manifest) return { dir: child, manifest };
  }
  return null;
}

export function installModelFolder(
  src: string,
  opts: { modelsDir: string; envFile: string },
): ModelInstallResult {
  if (!existsSync(src) || !statSync(src).isDirectory()) {
    return { ok: false, error: 'That is not a folder.' };
  }
  const resolved = resolveModelDir(src);
  if (!resolved) return { ok: false, error: 'No .model3.json found in that folder.' };
  const name = basename(resolved.dir);
  cpSync(resolved.dir, join(opts.modelsDir, name), { recursive: true });
  const modelUrl = `/models/${name}/${resolved.manifest}`;
  writeFileSync(opts.envFile, mergeEnvFile(readFileSync(opts.envFile, 'utf8'), { LUNA_MODEL_URL: modelUrl }));
  return { ok: true, modelUrl };
}
