import { describe, expect, it } from 'bun:test';
import { resolve } from 'node:path';
import { resolveTtsConfig, ttsProxyScript } from './tts';

const REPO = '/repo';
const yes = (): boolean => true;
const no = (): boolean => false;

describe('resolveTtsConfig', () => {
  it('has no default dir — unset LUNA_TTS_DIR → empty + unavailable (voice is BYO), port 8788', () => {
    const cfg = resolveTtsConfig({}, REPO, yes);
    expect(cfg.dir).toBe('');
    expect(cfg.available).toBe(false); // no dir → nothing to probe, even if existsFn says yes
    expect(cfg.port).toBe(8788);
    expect(cfg.upstream).toBe('http://127.0.0.1:8788');
  });

  it('honors LUNA_TTS_DIR and LUNA_TTS_PORT overrides', () => {
    const cfg = resolveTtsConfig({ LUNA_TTS_DIR: '/custom/tts', LUNA_TTS_PORT: '9999' }, REPO, no);
    expect(cfg.dir).toBe('/custom/tts');
    expect(cfg.port).toBe(9999);
    expect(cfg.upstream).toBe('http://127.0.0.1:9999');
  });

  it('probes the GPT-SoVITS module for availability at <dir>/server/gpt-sovits-service.js', () => {
    const seen: string[] = [];
    const cfg = resolveTtsConfig({ LUNA_TTS_DIR: '/custom/tts' }, REPO, (p) => {
      seen.push(p);
      return true;
    });
    expect(cfg.available).toBe(true);
    expect(seen).toContain(resolve('/custom/tts', 'server', 'gpt-sovits-service.js'));
  });

  it('is unavailable when the module is absent, available when present (with a dir set)', () => {
    expect(resolveTtsConfig({ LUNA_TTS_DIR: '/custom/tts' }, REPO, no).available).toBe(false);
    expect(resolveTtsConfig({ LUNA_TTS_DIR: '/custom/tts' }, REPO, yes).available).toBe(true);
  });
});

describe('ttsProxyScript', () => {
  it('points at scripts/tts-proxy.cjs under the repo root', () => {
    expect(ttsProxyScript(REPO)).toBe(resolve(REPO, 'scripts', 'tts-proxy.cjs'));
  });
});
