import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installModelFolder, resolveModelDir } from './modelInstall';
import { parseEnvFile } from './envfile';

let dirs: string[] = [];
function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), 'luna-model-'));
  dirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs = [];
});

function makeModel(dir: string, name: string): void {
  writeFileSync(join(dir, `${name}.model3.json`), '{}');
  writeFileSync(join(dir, `${name}.moc3`), 'moc');
  mkdirSync(join(dir, 'textures'));
  writeFileSync(join(dir, 'textures', 'tex.png'), 'png');
}

function setup(): { modelsDir: string; envFile: string } {
  const base = tmp();
  const modelsDir = join(base, 'models');
  mkdirSync(modelsDir);
  const envFile = join(base, 'luna.env');
  writeFileSync(envFile, '# config\nLUNA_MODEL_URL=\n');
  return { modelsDir, envFile };
}

describe('installModelFolder (v0.35.2)', () => {
  test('a direct model folder installs, writes LUNA_MODEL_URL, and preserves the env file', () => {
    const src = join(tmp(), 'puppy');
    mkdirSync(src);
    makeModel(src, 'puppy');
    const opts = setup();
    const r = installModelFolder(src, opts);
    expect(r).toEqual({ ok: true, modelUrl: '/models/puppy/puppy.model3.json' });
    expect(existsSync(join(opts.modelsDir, 'puppy', 'puppy.model3.json'))).toBe(true);
    expect(existsSync(join(opts.modelsDir, 'puppy', 'textures', 'tex.png'))).toBe(true);
    const env = readFileSync(opts.envFile, 'utf8');
    expect(parseEnvFile(env)['LUNA_MODEL_URL']).toBe('/models/puppy/puppy.model3.json');
    expect(env).toContain('# config');
  });

  test('the unzip-wrapper case: the model one level down is found and installed under ITS name', () => {
    const wrapper = join(tmp(), 'download');
    mkdirSync(wrapper);
    const inner = join(wrapper, 'puppy_v2');
    mkdirSync(inner);
    makeModel(inner, 'puppy');
    const opts = setup();
    const r = installModelFolder(wrapper, opts);
    expect(r.ok).toBe(true);
    expect(r.modelUrl).toBe('/models/puppy_v2/puppy.model3.json');
  });

  test('no manifest anywhere → the verbatim picker error, and nothing is copied', () => {
    const src = join(tmp(), 'random');
    mkdirSync(src);
    writeFileSync(join(src, 'readme.txt'), 'hi');
    const opts = setup();
    const r = installModelFolder(src, opts);
    expect(r).toEqual({ ok: false, error: 'No .model3.json found in that folder.' });
    expect(readdirSync(opts.modelsDir)).toEqual([]);
    expect(parseEnvFile(readFileSync(opts.envFile, 'utf8'))['LUNA_MODEL_URL']).toBe('');
  });

  test('a file (not a folder) fails cleanly', () => {
    const base = tmp();
    const file = join(base, 'model.zip');
    writeFileSync(file, 'zip');
    const r = installModelFolder(file, setup());
    expect(r).toEqual({ ok: false, error: 'That is not a folder.' });
  });

  test('copy-only contract: the source folder is untouched after install', () => {
    const src = join(tmp(), 'puppy');
    mkdirSync(src);
    makeModel(src, 'puppy');
    const before = readdirSync(src).sort();
    installModelFolder(src, setup());
    expect(readdirSync(src).sort()).toEqual(before);
  });

  test('re-install over the same name overwrites deterministically', () => {
    const src = join(tmp(), 'puppy');
    mkdirSync(src);
    makeModel(src, 'puppy');
    const opts = setup();
    expect(installModelFolder(src, opts).ok).toBe(true);
    writeFileSync(join(src, 'puppy.moc3'), 'moc-v2');
    expect(installModelFolder(src, opts).ok).toBe(true);
    expect(readFileSync(join(opts.modelsDir, 'puppy', 'puppy.moc3'), 'utf8')).toBe('moc-v2');
  });
});

describe('resolveModelDir', () => {
  test('two levels down is NOT resolved — ambiguous nesting fails loudly, not guessed', () => {
    const top = join(tmp(), 'deep');
    mkdirSync(top);
    const mid = join(top, 'a');
    mkdirSync(mid);
    const leaf = join(mid, 'b');
    mkdirSync(leaf);
    makeModel(leaf, 'x');
    expect(resolveModelDir(top)).toBeNull();
  });
});
