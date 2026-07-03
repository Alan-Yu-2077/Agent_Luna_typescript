import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// v0.28.7: desktop TTS config. Initiative 19 shipped serve.ts with a hardcoded 502 stub for
// /api/gpt-sovits/* and never spawned the GPT-SoVITS proxy — so the desktop app showed the boot
// gate's "Loading the voice model" animation, then always degraded to muted. This resolves the same
// LUNA_TTS_DIR / LUNA_TTS_PORT knobs dev-all.ts uses so the shell can forward to (and spawn) the
// local proxy. `available` mirrors dev-all's probe: the Python GPT-SoVITS module must be present, or
// the app degrades to silence (the module is local-only, never bundled — LD: TTS stays unshipped).

export type TtsConfig = {
  dir: string;
  port: number;
  available: boolean;
  upstream: string;
};

export function resolveTtsConfig(
  env: Record<string, string | undefined>,
  repoRoot: string,
  existsFn: (p: string) => boolean = existsSync,
): TtsConfig {
  const dir = env['LUNA_TTS_DIR'] ?? resolve(repoRoot, '..', 'Agent_Luna', 'TTS');
  const port = Number(env['LUNA_TTS_PORT'] ?? 8788);
  const available = existsFn(resolve(dir, 'server', 'gpt-sovits-service.js'));
  return { dir, port, available, upstream: `http://127.0.0.1:${port}` };
}

// The standalone proxy the shell spawns (scripts/tts-proxy.cjs) — only exists in a source checkout,
// not in a packaged app, so its presence is a second guard before spawning.
export function ttsProxyScript(repoRoot: string): string {
  return resolve(repoRoot, 'scripts', 'tts-proxy.cjs');
}
