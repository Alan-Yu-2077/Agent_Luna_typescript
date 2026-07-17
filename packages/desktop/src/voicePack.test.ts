import { afterEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  generateTtsYaml,
  installVoicePack,
  scanVoicePack,
  startCommand,
  validateRuntimeDir,
  validateVoicePack,
} from './voicePack';
import { parseEnvFile } from './envfile';

let dirs: string[] = [];
function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), 'luna-voice-'));
  dirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs = [];
});

// The canonical weights-only pack shape (the reference instance's assets/ convention).
function makeWeightsPack(root: string, name = 'Voice'): void {
  mkdirSync(join(root, 'GPT'), { recursive: true });
  mkdirSync(join(root, 'SoVITS'), { recursive: true });
  mkdirSync(join(root, 'reference'), { recursive: true });
  writeFileSync(join(root, 'GPT', `${name}-e24.ckpt`), 'gpt');
  writeFileSync(join(root, 'SoVITS', `${name}_e24_s21168.pth`), 'sovits');
  writeFileSync(join(root, 'reference', 'reference.wav'), 'wav');
  writeFileSync(join(root, 'reference', 'reference.txt'), 'You want me to say something nice');
}

function setupEnv(): { ttsDir: string; envFile: string } {
  const base = tmp();
  const ttsDir = join(base, 'tts');
  const envFile = join(base, 'luna.env');
  writeFileSync(envFile, '# cfg\nLUNA_TTS_BACKEND=browser\nLUNA_TTS_URL=\n');
  return { ttsDir, envFile };
}

describe('scanVoicePack (v0.35.3)', () => {
  test('weights-only pack: every slot found', () => {
    const root = join(tmp(), 'NeoVoice');
    mkdirSync(root);
    makeWeightsPack(root);
    const scan = scanVoicePack(root);
    expect(scan.gpt.length).toBe(1);
    expect(scan.sovits.length).toBe(1);
    expect(scan.refWavs.length).toBe(1);
    expect(scan.transcripts.length).toBe(1);
    expect(validateVoicePack(scan).ok).toBe(true);
  });

  test('整合包 shape: runtime dirs are skipped — pretrained weights never offered as "your voice"', () => {
    const root = join(tmp(), 'bundle');
    mkdirSync(root);
    // the runtime bundle: GPT_SoVITS/pretrained_models full of base ckpt/pth
    const pre = join(root, 'GPT_SoVITS', 'pretrained_models');
    mkdirSync(pre, { recursive: true });
    writeFileSync(join(pre, 's1bert-base.ckpt'), 'pretrained');
    writeFileSync(join(pre, 's2G488k.pth'), 'pretrained');
    mkdirSync(join(root, 'runtime'));
    writeFileSync(join(root, 'runtime', 'python.pth'), 'runtime-cruft');
    // the actual voice weights at the bundle root (GPT_weights_v2 style)
    mkdirSync(join(root, 'GPT_weights_v2'));
    writeFileSync(join(root, 'GPT_weights_v2', 'Neo-e24.ckpt'), 'gpt');
    mkdirSync(join(root, 'SoVITS_weights_v2'));
    writeFileSync(join(root, 'SoVITS_weights_v2', 'Neo_e24.pth'), 'sovits');
    writeFileSync(join(root, 'ref.wav'), 'wav');
    const scan = scanVoicePack(root);
    expect(scan.gpt).toEqual([join(root, 'GPT_weights_v2', 'Neo-e24.ckpt')]);
    expect(scan.sovits).toEqual([join(root, 'SoVITS_weights_v2', 'Neo_e24.pth')]);
  });

  test('two voices → both surface (a choice, never a guess)', () => {
    const root = join(tmp(), 'duo');
    mkdirSync(root);
    writeFileSync(join(root, 'A.ckpt'), 'a');
    writeFileSync(join(root, 'B.ckpt'), 'b');
    writeFileSync(join(root, 'A.pth'), 'a');
    writeFileSync(join(root, 'ref.wav'), 'w');
    expect(scanVoicePack(root).gpt.length).toBe(2);
  });

  test('missing slots produce named, actionable errors', () => {
    const root = join(tmp(), 'partial');
    mkdirSync(root);
    writeFileSync(join(root, 'A.ckpt'), 'a');
    expect(validateVoicePack(scanVoicePack(root)).error).toContain('.pth');
    writeFileSync(join(root, 'A.pth'), 'a');
    expect(validateVoicePack(scanVoicePack(root)).error).toContain('.wav');
  });
});

describe('installVoicePack', () => {
  test('normalizes into GPT/SoVITS/reference, writes the reference-instance env block, reads the transcript', () => {
    const root = join(tmp(), 'NeoVoice');
    mkdirSync(root);
    makeWeightsPack(root, 'Neo');
    const scan = scanVoicePack(root);
    const opts = setupEnv();
    const r = installVoicePack(
      root,
      {
        gptCkpt: scan.gpt[0]!,
        sovitsPth: scan.sovits[0]!,
        referenceWav: scan.refWavs[0]!,
        transcriptTxt: scan.transcripts[0]!,
      },
      { ...opts, promptLang: 'en', textLang: 'auto' },
    );
    expect(r.ok).toBe(true);
    expect(readdirSync(join(opts.ttsDir, 'NeoVoice')).sort()).toEqual(['GPT', 'SoVITS', 'reference']);
    const env = parseEnvFile(readFileSync(opts.envFile, 'utf8'));
    expect(env['LUNA_TTS_BACKEND']).toBe('http');
    expect(env['LUNA_TTS_URL']).toBe('http://127.0.0.1:9880');
    expect(env['LUNA_TTS_REF_AUDIO']).toBe(join(opts.ttsDir, 'NeoVoice', 'reference', 'reference.wav'));
    expect(env['LUNA_TTS_PROMPT_TEXT']).toBe('You want me to say something nice');
    expect(env['LUNA_TTS_PROMPT_LANG']).toBe('en');
    expect(env['LUNA_TTS_TEXT_LANG']).toBe('auto');
  });

  test('only the picked files are copied — runtime gigabytes stay out of userData', () => {
    const root = join(tmp(), 'bundle');
    mkdirSync(root);
    makeWeightsPack(root, 'Neo');
    mkdirSync(join(root, 'runtime'));
    writeFileSync(join(root, 'runtime', 'huge.bin'), 'x'.repeat(1000));
    const scan = scanVoicePack(root);
    const opts = setupEnv();
    installVoicePack(
      root,
      { gptCkpt: scan.gpt[0]!, sovitsPth: scan.sovits[0]!, referenceWav: scan.refWavs[0]! },
      opts,
    );
    expect(existsSync(join(opts.ttsDir, 'bundle', 'runtime'))).toBe(false);
    expect(readdirSync(join(opts.ttsDir, 'bundle', 'GPT'))).toEqual(['Neo-e24.ckpt']);
  });

  test('a hand-set LUNA_TTS_URL is never clobbered; explicit promptText beats the transcript file; idempotent re-install', () => {
    const root = join(tmp(), 'NeoVoice');
    mkdirSync(root);
    makeWeightsPack(root, 'Neo');
    const scan = scanVoicePack(root);
    const base = tmp();
    const ttsDir = join(base, 'tts');
    const envFile = join(base, 'luna.env');
    writeFileSync(envFile, 'LUNA_TTS_URL=http://10.0.0.5:9880\n');
    const picks = {
      gptCkpt: scan.gpt[0]!,
      sovitsPth: scan.sovits[0]!,
      referenceWav: scan.refWavs[0]!,
      transcriptTxt: scan.transcripts[0]!,
    };
    const r1 = installVoicePack(root, picks, { ttsDir, envFile, promptText: 'Custom transcript wins' });
    expect(r1.ok).toBe(true);
    const r2 = installVoicePack(root, picks, { ttsDir, envFile, promptText: 'Custom transcript wins' });
    expect(r2.ok).toBe(true);
    const env = parseEnvFile(readFileSync(envFile, 'utf8'));
    expect(env['LUNA_TTS_URL']).toBe('http://10.0.0.5:9880');
    expect(env['LUNA_TTS_PROMPT_TEXT']).toBe('Custom transcript wins');
  });
});

describe('runtime dir + yaml + command (the canonical standard)', () => {
  function makeCheckout(withVenv: boolean): string {
    const dir = join(tmp(), 'GPT-SoVITS');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'api_v2.py'), '# api');
    const pre = join(dir, 'GPT_SoVITS', 'pretrained_models');
    mkdirSync(join(pre, 'chinese-roberta-wwm-ext-large'), { recursive: true });
    mkdirSync(join(pre, 'chinese-hubert-base'), { recursive: true });
    if (withVenv) {
      mkdirSync(join(dir, '.venv', 'bin'), { recursive: true });
      writeFileSync(join(dir, '.venv', 'bin', 'python'), '#!/usr/bin/env python');
    }
    return dir;
  }

  test('validateRuntimeDir: venv detected; missing api_v2 / pretrained produce named errors', () => {
    const withVenv = makeCheckout(true);
    // 'darwin' explicitly: makeCheckout writes the POSIX .venv/bin/python layout, so the test must
    // ask for that layout regardless of the host OS (on a win runner the default would seek Scripts\).
    expect(validateRuntimeDir(withVenv, 'darwin')).toEqual({
      ok: true,
      venvPython: join(withVenv, '.venv', 'bin', 'python'),
    });
    expect(validateRuntimeDir(makeCheckout(false), 'darwin').venvPython).toBeUndefined();
    const empty = tmp();
    expect(validateRuntimeDir(empty).error).toContain('api_v2.py');
    const noPre = join(tmp(), 'half');
    mkdirSync(noPre);
    writeFileSync(join(noPre, 'api_v2.py'), '# api');
    expect(validateRuntimeDir(noPre).error).toContain('pretrained');
  });

  test('generateTtsYaml is the reference instance shape, field for field', () => {
    const checkout = '/opt/GPT-SoVITS';
    const yaml = generateTtsYaml({
      checkout,
      gptCkpt: '/data/tts/Neo/GPT/Neo-e24.ckpt',
      sovitsPth: '/data/tts/Neo/SoVITS/Neo_e24.pth',
    });
    // bert/cnhuhbert paths are join()'d inside generateTtsYaml → build the expectation the same way
    // so it matches on any OS (backslashes on win32); the weight paths pass through verbatim.
    const pre = join(checkout, 'GPT_SoVITS', 'pretrained_models');
    expect(yaml).toBe(
      [
        'custom:',
        `  bert_base_path: ${join(pre, 'chinese-roberta-wwm-ext-large')}`,
        `  cnhuhbert_base_path: ${join(pre, 'chinese-hubert-base')}`,
        '  device: cpu',
        '  is_half: false',
        '  version: v2',
        '  t2s_weights_path: /data/tts/Neo/GPT/Neo-e24.ckpt',
        '  vits_weights_path: /data/tts/Neo/SoVITS/Neo_e24.pth',
        '',
      ].join('\n'),
    );
  });

  test('startCommand: venv → .venv/bin/python; none → python3; the one true -a/-p/-c form', () => {
    const venvCmd = startCommand(
      {
        checkout: '/opt/GPT-SoVITS',
        venvPython: '/opt/GPT-SoVITS/.venv/bin/python',
        yamlPath: '/data/tts/Neo/tts_infer.runtime.yaml',
      },
      'darwin', // the POSIX form regardless of the host OS
    );
    expect(venvCmd).toBe(
      "cd '/opt/GPT-SoVITS' && .venv/bin/python api_v2.py -a 127.0.0.1 -p 9880 -c '/data/tts/Neo/tts_infer.runtime.yaml'",
    );
    const bare = startCommand({ checkout: '/opt/G', yamlPath: '/y.yaml' }, 'darwin');
    expect(bare).toContain('python3 api_v2.py -a 127.0.0.1 -p 9880 -c');
    const spaced = startCommand({ checkout: "/opt/my dir/G'S", yamlPath: '/y.yaml' }, 'darwin');
    expect(spaced).toContain("'/opt/my dir/G'\\''S'");
  });

  // v0.38.0 — win32 branches (display-only copy-paste surface).
  test('validateRuntimeDir on win32 detects the Scripts\\python.exe venv layout', () => {
    const dir = join(tmp(), 'GPT-SoVITS-win');
    mkdirSync(join(dir, 'GPT_SoVITS', 'pretrained_models', 'chinese-roberta-wwm-ext-large'), { recursive: true });
    mkdirSync(join(dir, 'GPT_SoVITS', 'pretrained_models', 'chinese-hubert-base'), { recursive: true });
    writeFileSync(join(dir, 'api_v2.py'), '# api');
    mkdirSync(join(dir, '.venv', 'Scripts'), { recursive: true });
    writeFileSync(join(dir, '.venv', 'Scripts', 'python.exe'), '');
    expect(validateRuntimeDir(dir, 'win32')).toEqual({
      ok: true,
      venvPython: join(dir, '.venv', 'Scripts', 'python.exe'),
    });
    // the same checkout has no POSIX venv → win32 must NOT report the bin/python one
    expect(validateRuntimeDir(dir, 'darwin').venvPython).toBeUndefined();
  });

  test('startCommand on win32 is PowerShell-form with the Scripts venv (or bare python)', () => {
    const venv = startCommand(
      { checkout: 'C:\\tts\\GPT-SoVITS', venvPython: 'C:\\tts\\GPT-SoVITS\\.venv\\Scripts\\python.exe', yamlPath: 'C:\\tts\\v.yaml' },
      'win32',
    );
    expect(venv).toBe('cd "C:\\tts\\GPT-SoVITS"; & .\\.venv\\Scripts\\python.exe api_v2.py -a 127.0.0.1 -p 9880 -c "C:\\tts\\v.yaml"');
    const bare = startCommand({ checkout: 'C:\\g', yamlPath: 'C:\\v.yaml' }, 'win32');
    expect(bare).toBe('cd "C:\\g"; & python api_v2.py -a 127.0.0.1 -p 9880 -c "C:\\v.yaml"');
  });

  test('no-execute contract: this module never touches child_process', () => {
    const src = readFileSync(join(import.meta.dir, 'voicePack.ts'), 'utf8');
    expect(src).not.toContain('child_process');
    expect(src).not.toContain('spawn(');
    expect(src).not.toContain('execSync');
    expect(src).not.toContain('Bun.spawn');
    expect(src).not.toMatch(/\bexec\(/);
  });
});
