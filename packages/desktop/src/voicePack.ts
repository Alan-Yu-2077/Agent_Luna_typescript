// v0.35.3 (Initiative 25): the GPT-SoVITS voice-pack installer, pinned to the reference-instance
// standard — a checkout + venv runs `api_v2.py -a 127.0.0.1 -p 9880 -c <yaml>`, the yaml is a
// `custom:` section (device cpu / is_half false / version v2 / bert+cnhuhbert inside the checkout),
// and weights normalize into GPT/ SoVITS/ reference/. Scan-based: the downloaded pack may be a
// weights-only folder OR a full 整合包 (runtime bundle) — we walk it, skip runtime directories, and
// copy ONLY the picked weight/reference files. Nothing in the pack is ever executed. Electron-free.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { mergeEnvFile } from './onboarding';
import { parseEnvFile } from './envfile';

export type VoiceScan = { gpt: string[]; sovits: string[]; refWavs: string[]; transcripts: string[] };

// Runtime-bundle directories weights never live in. GPT_SoVITS holds the PRETRAINED s1/s2 models —
// skipping it is what keeps a 整合包 scan from offering the base models as "your voice".
const SKIP_DIRS = new Set([
  'GPT_SoVITS',
  'runtime',
  'venv',
  '.venv',
  '.git',
  '__pycache__',
  'node_modules',
  'pretrained_models',
  'docs',
  'tools',
]);

export function scanVoicePack(root: string, maxDepth = 6): VoiceScan {
  const scan: VoiceScan = { gpt: [], sovits: [], refWavs: [], transcripts: [] };
  const walk = (dir: string, depth: number): void => {
    if (depth > maxDepth) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name) || e.name.startsWith('python') || e.name.startsWith('.')) continue;
        walk(p, depth + 1);
      } else if (e.isFile()) {
        const lower = e.name.toLowerCase();
        if (lower.endsWith('.ckpt')) scan.gpt.push(p);
        else if (lower.endsWith('.pth')) scan.sovits.push(p);
        else if (lower.endsWith('.wav')) scan.refWavs.push(p);
        else if (lower.endsWith('.txt') || lower.endsWith('.lab')) scan.transcripts.push(p);
      }
    }
  };
  walk(root, 0);
  return scan;
}

export function validateVoicePack(scan: VoiceScan): { ok: boolean; error?: string } {
  if (scan.gpt.length === 0) return { ok: false, error: 'No GPT weight (.ckpt) found in the folder.' };
  if (scan.sovits.length === 0) return { ok: false, error: 'No SoVITS weight (.pth) found in the folder.' };
  if (scan.refWavs.length === 0) return { ok: false, error: 'No reference audio (.wav) found in the folder.' };
  return { ok: true };
}

export type VoicePicks = {
  gptCkpt: string;
  sovitsPth: string;
  referenceWav: string;
  transcriptTxt?: string;
};

export type VoiceInstall = {
  ok: boolean;
  packDir?: string;
  gptCkpt?: string;
  sovitsPth?: string;
  refAudio?: string;
  promptText?: string;
  error?: string;
};

// Copy the picked files into the canonical layout and write the reference-instance luna.env block.
// LUNA_TTS_URL is set only when currently empty (a hand-configured URL is never clobbered).
export function installVoicePack(
  root: string,
  picks: VoicePicks,
  opts: { ttsDir: string; envFile: string; promptText?: string; promptLang?: string; textLang?: string },
): VoiceInstall {
  for (const p of [picks.gptCkpt, picks.sovitsPth, picks.referenceWav]) {
    if (!p || !existsSync(p)) return { ok: false, error: 'A picked file no longer exists — re-scan the folder.' };
  }
  const packDir = join(opts.ttsDir, basename(root));
  const gptDir = join(packDir, 'GPT');
  const sovitsDir = join(packDir, 'SoVITS');
  const refDir = join(packDir, 'reference');
  for (const d of [gptDir, sovitsDir, refDir]) mkdirSync(d, { recursive: true });
  const gptCkpt = join(gptDir, basename(picks.gptCkpt));
  const sovitsPth = join(sovitsDir, basename(picks.sovitsPth));
  const refAudio = join(refDir, basename(picks.referenceWav));
  cpSync(picks.gptCkpt, gptCkpt);
  cpSync(picks.sovitsPth, sovitsPth);
  cpSync(picks.referenceWav, refAudio);

  let promptText = (opts.promptText ?? '').trim();
  if (promptText === '' && picks.transcriptTxt && existsSync(picks.transcriptTxt)) {
    promptText = readFileSync(picks.transcriptTxt, 'utf8').trim();
  }

  const existing = readFileSync(opts.envFile, 'utf8');
  const fields: Record<string, string> = {
    LUNA_TTS_BACKEND: 'http',
    LUNA_TTS_REF_AUDIO: refAudio,
    LUNA_TTS_PROMPT_LANG: opts.promptLang?.trim() || 'en',
    LUNA_TTS_TEXT_LANG: opts.textLang?.trim() || 'auto',
  };
  if ((parseEnvFile(existing)['LUNA_TTS_URL'] ?? '') === '') fields['LUNA_TTS_URL'] = 'http://127.0.0.1:9880';
  if (promptText !== '') fields['LUNA_TTS_PROMPT_TEXT'] = promptText;
  writeFileSync(opts.envFile, mergeEnvFile(existing, fields));
  return { ok: true, packDir, gptCkpt, sovitsPth, refAudio, promptText };
}

export type RuntimeCheck = { ok: boolean; venvPython?: string; error?: string };

// A GPT-SoVITS checkout per the reference instance: api_v2.py at the root, the two pretrained
// model dirs under GPT_SoVITS/pretrained_models, optionally a .venv. v0.38.0: the venv layout is
// `.venv\Scripts\python.exe` on win32, `.venv/bin/python` elsewhere.
export function validateRuntimeDir(dir: string, platform: NodeJS.Platform = process.platform): RuntimeCheck {
  if (!existsSync(join(dir, 'api_v2.py')))
    return { ok: false, error: 'api_v2.py not found — point at a GPT-SoVITS checkout (github.com/RVC-Boss/GPT-SoVITS).' };
  const pre = join(dir, 'GPT_SoVITS', 'pretrained_models');
  if (!existsSync(join(pre, 'chinese-roberta-wwm-ext-large')) || !existsSync(join(pre, 'chinese-hubert-base')))
    return { ok: false, error: 'Pretrained models missing under GPT_SoVITS/pretrained_models — finish the GPT-SoVITS setup first.' };
  const venv =
    platform === 'win32' ? join(dir, '.venv', 'Scripts', 'python.exe') : join(dir, '.venv', 'bin', 'python');
  return existsSync(venv) ? { ok: true, venvPython: venv } : { ok: true };
}

// The reference instance's tts_infer.runtime.yaml `custom:` section, field for field.
export function generateTtsYaml(o: { checkout: string; gptCkpt: string; sovitsPth: string }): string {
  return [
    'custom:',
    `  bert_base_path: ${join(o.checkout, 'GPT_SoVITS', 'pretrained_models', 'chinese-roberta-wwm-ext-large')}`,
    `  cnhuhbert_base_path: ${join(o.checkout, 'GPT_SoVITS', 'pretrained_models', 'chinese-hubert-base')}`,
    '  device: cpu',
    '  is_half: false',
    '  version: v2',
    `  t2s_weights_path: ${o.gptCkpt}`,
    `  vits_weights_path: ${o.sovitsPth}`,
    '',
  ].join('\n');
}

function shellQuote(p: string): string {
  return `'${p.replace(/'/g, `'\\''`)}'`;
}

// The one true launch form (verified against api_v2.py's argparse: -a/--bind_addr, -p/--port,
// -c/--tts_config). venv when the checkout has one, else python3/python + it's on the user to have
// deps. v0.38.0: this is a copy-paste display surface only (managed mode spawns argv directly), so
// the win32 branch emits a PowerShell-form command with the Scripts\ venv layout.
export function startCommand(
  o: { checkout: string; venvPython?: string; yamlPath: string },
  platform: NodeJS.Platform = process.platform,
): string {
  if (platform === 'win32') {
    const py = o.venvPython ? '.\\.venv\\Scripts\\python.exe' : 'python';
    return `cd "${o.checkout}"; & ${py} api_v2.py -a 127.0.0.1 -p 9880 -c "${o.yamlPath}"`;
  }
  const py = o.venvPython ? '.venv/bin/python' : 'python3';
  return `cd ${shellQuote(o.checkout)} && ${py} api_v2.py -a 127.0.0.1 -p 9880 -c ${shellQuote(o.yamlPath)}`;
}
