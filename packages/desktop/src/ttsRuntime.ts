// v0.37.0 (Initiative 27): the managed-voice runtime seam. Decides WHETHER Luna owns the GPT-SoVITS
// api_v2 process (LUNA_TTS_MANAGED=1) and WHAT to launch — as argv for the supervisor, never a shell
// string (voicePack.startCommand stays the copy-paste BYO form). All spawning lives in main.ts +
// supervisor.ts; this module only resolves paths, so voicePack's no-execute discipline extends here:
// nothing derived from a dropped pack is ever executed — only Luna's vetted api_v2 entrypoint.
// Electron-free + injectable fs so it unit-tests headlessly.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export type ManagedRuntime = {
  kind: 'provisioned' | 'byo';
  checkout: string; // the GPT-SoVITS dir — the child's cwd
  python: string; // venv python inside the checkout, else bare python3
  yamlPath: string; // tts_infer config passed via -c
  host: string;
  port: number;
};

export type VoiceProcState = 'idle' | 'starting' | 'restarting' | 'gave-up';

export type RuntimeFs = {
  exists(p: string): boolean;
  readText(p: string): string;
  // pack yamls under <ttsDir>/<pack>/tts_infer.runtime.yaml, any order; resolver picks newest
  listPackYamls(ttsDir: string): Array<{ path: string; mtimeMs: number }>;
};

const realFs: RuntimeFs = {
  exists: (p) => existsSync(p),
  readText: (p) => readFileSync(p, 'utf8'),
  listPackYamls: (ttsDir) => {
    if (!existsSync(ttsDir)) return [];
    const out: Array<{ path: string; mtimeMs: number }> = [];
    for (const e of readdirSync(ttsDir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const y = join(ttsDir, e.name, 'tts_infer.runtime.yaml');
      if (existsSync(y)) out.push({ path: y, mtimeMs: statSync(y).mtimeMs });
    }
    return out;
  },
};

// Loopback only: a remote LUNA_TTS_URL is someone else's server — never ours to spawn or restart.
export function parseLoopbackUrl(url: string | undefined): { host: string; port: number } | null {
  const raw = (url ?? '').trim() === '' ? 'http://127.0.0.1:9880' : (url ?? '');
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.hostname !== '127.0.0.1' && u.hostname !== 'localhost') return null;
  const port = u.port === '' ? 9880 : Number(u.port);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) return null;
  return { host: '127.0.0.1', port };
}

function venvPython(checkout: string, platform: NodeJS.Platform, fs: RuntimeFs): string | null {
  const p =
    platform === 'win32'
      ? join(checkout, '.venv', 'Scripts', 'python.exe')
      : join(checkout, '.venv', 'bin', 'python');
  return fs.exists(p) ? p : null;
}

// A launchable checkout per the reference instance: the entrypoint + both pretrained model dirs.
// (Same checks as voicePack.validateRuntimeDir, reimplemented on the injectable fs seam.)
function launchableCheckout(dir: string, fs: RuntimeFs): boolean {
  if (!fs.exists(join(dir, 'api_v2.py'))) return false;
  const pre = join(dir, 'GPT_SoVITS', 'pretrained_models');
  return fs.exists(join(pre, 'chinese-roberta-wwm-ext-large')) && fs.exists(join(pre, 'chinese-hubert-base'));
}

function provisionReady(runtimeDir: string, fs: RuntimeFs): boolean {
  const marker = join(runtimeDir, '..', 'provision.json');
  if (!fs.exists(marker)) return false;
  try {
    const state = (JSON.parse(fs.readText(marker)) as { state?: unknown }).state;
    return state === 'ready';
  } catch {
    return false;
  }
}

// The launchable checkout alone (no yaml requirement) — what a FIRST pack install writes its yaml
// against, before any pack exists to make the full runtime resolvable.
export function resolveManagedCheckout(
  env: Record<string, string | undefined>,
  opts: { userData: string; fs?: RuntimeFs },
): { kind: ManagedRuntime['kind']; checkout: string } | null {
  if (env['LUNA_TTS_MANAGED'] !== '1') return null;
  const fs = opts.fs ?? realFs;
  const ttsDir = join(opts.userData, 'tts');
  const provisionedDir = join(ttsDir, 'runtime');
  if (provisionReady(provisionedDir, fs) && launchableCheckout(provisionedDir, fs))
    return { kind: 'provisioned', checkout: provisionedDir };
  const byo = (env['LUNA_TTS_RUNTIME_DIR'] ?? '').trim();
  if (byo !== '' && launchableCheckout(byo, fs)) return { kind: 'byo', checkout: byo };
  return null;
}

export function resolveManagedRuntime(
  env: Record<string, string | undefined>,
  opts: { userData: string; platform?: NodeJS.Platform; fs?: RuntimeFs },
): ManagedRuntime | null {
  const fs = opts.fs ?? realFs;
  const platform = opts.platform ?? process.platform;
  const target = parseLoopbackUrl(env['LUNA_TTS_URL']);
  if (!target) return null;

  const co = resolveManagedCheckout(env, { userData: opts.userData, fs });
  if (co === null) return null;
  const { kind, checkout } = co;
  const ttsDir = join(opts.userData, 'tts');

  // The voice to load = the most recently installed pack's yaml. NO pack → NO launch (v0.37.2,
  // Open Q4): GPT-SoVITS is zero-shot — without a pack there are no custom weights, and the stock
  // config points at pretrained checkpoints the lean provisioned runtime deliberately omits. The app
  // keeps the browser voice until the first pack drops; the wizard says so plainly.
  const packYamls = fs.listPackYamls(ttsDir).sort((a, b) => b.mtimeMs - a.mtimeMs);
  const yamlPath = packYamls[0]?.path;
  if (yamlPath === undefined) return null;

  // The 整合包 (provisioned win32) ships its own embedded python instead of a venv. Last-resort bare
  // name is 'python' on win32 (python.org installs python.exe; 'python3' usually doesn't exist there).
  const embeddedWin = join(checkout, 'runtime', 'python.exe');
  const python =
    venvPython(checkout, platform, fs) ??
    (platform === 'win32' ? (fs.exists(embeddedWin) ? embeddedWin : 'python') : 'python3');

  return { kind, checkout, python, yamlPath, host: target.host, port: target.port };
}

// Argv for the supervisor — the one true launch form (api_v2.py argparse: -a/-p/-c), same shape the
// owner's reference instance runs, never a shell string.
export function buildTtsArgv(rt: ManagedRuntime): { command: string; args: string[]; cwd: string } {
  return {
    command: rt.python,
    args: ['api_v2.py', '-a', rt.host, '-p', String(rt.port), '-c', rt.yamlPath],
    cwd: rt.checkout,
  };
}

// v0.37.13: pick a pack's weight by EXTENSION. installVoicePack writes exactly one .ckpt into GPT/
// and one .pth into SoVITS/, but a stray readme.txt or a macOS AppleDouble (._) fork must never be
// mistaken for it. Pure so adoptInstalledPacks's file choice is unit-tested without a filesystem.
export function pickWeight(names: string[], ext: string): string | undefined {
  return names.find((n) => !n.startsWith('.') && !n.startsWith('._') && n.toLowerCase().endsWith(ext));
}
