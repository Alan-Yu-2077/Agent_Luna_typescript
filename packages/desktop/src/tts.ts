import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Desktop TTS config. Voice is bring-your-own: point LUNA_TTS_DIR at a local GPT-SoVITS install and
// the shell forwards to (and spawns) the proxy; unset (the default) → no dir → `available` is false →
// the app degrades to silence. `available` probes the proxy's entry module so a wrong/partial dir also
// degrades cleanly rather than crash-looping the sidecar.

export type TtsConfig = {
  dir: string;
  port: number;
  available: boolean;
  upstream: string;
};

export function resolveTtsConfig(
  env: Record<string, string | undefined>,
  _repoRoot: string,
  existsFn: (p: string) => boolean = existsSync,
): TtsConfig {
  const dir = env['LUNA_TTS_DIR'] ?? '';
  const port = Number(env['LUNA_TTS_PORT'] ?? 8788);
  const available = dir !== '' && existsFn(resolve(dir, 'server', 'gpt-sovits-service.js'));
  return { dir, port, available, upstream: `http://127.0.0.1:${port}` };
}

// The standalone proxy the shell spawns (scripts/tts-proxy.cjs) — only exists in a source checkout,
// not in a packaged app, so its presence is a second guard before spawning.
export function ttsProxyScript(repoRoot: string): string {
  return resolve(repoRoot, 'scripts', 'tts-proxy.cjs');
}
