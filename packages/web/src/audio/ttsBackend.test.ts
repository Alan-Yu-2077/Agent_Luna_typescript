import { describe, expect, test } from 'bun:test';
import { resolveTtsBackend } from './ttsBackend';

const store = (m: Record<string, string>): Pick<Storage, 'getItem'> => ({ getItem: (k) => m[k] ?? null });

describe('resolveTtsBackend', () => {
  // v0.43.14 inverted this: the default WAS 'browser' (a fresh install spoke through the Web Speech
  // API with no setup). With distribution retired there is no fresh install to serve, and the only
  // thing that default did was let a foreign voice cut in. Unconfigured now means quiet.
  test('defaults to none when nothing is set', () => {
    expect(resolveTtsBackend({ storage: store({}), config: {} })).toBe('none');
    expect(resolveTtsBackend({ storage: null, config: undefined })).toBe('none');
  });

  test('luna:tts=0 forces none (the explicit off toggle wins over everything)', () => {
    expect(resolveTtsBackend({ storage: store({ 'luna:tts': '0', 'luna:tts-backend': 'http' }), config: {} })).toBe('none');
  });

  test('localStorage luna:tts-backend selects the backend', () => {
    expect(resolveTtsBackend({ storage: store({ 'luna:tts-backend': 'http' }), config: {} })).toBe('http');
    expect(resolveTtsBackend({ storage: store({ 'luna:tts-backend': 'none' }), config: {} })).toBe('none');
  });

  test('falls back to the injected config when storage is silent', () => {
    expect(resolveTtsBackend({ storage: store({}), config: { ttsBackend: 'http' } })).toBe('http');
  });

  // The precedence itself is unchanged — storage still beats config. What changed is that the value
  // being stored is no longer a backend, so the override resolves to silence rather than to 'browser'.
  test('storage still overrides the injected config', () => {
    expect(resolveTtsBackend({ storage: store({ 'luna:tts-backend': 'none' }), config: { ttsBackend: 'http' } })).toBe('none');
  });

  // The migration: an install that ran before v0.43.14 has 'browser' persisted in localStorage or
  // written into luna.env by the old wizard. It must read as silence — NOT be promoted to 'http',
  // which would point an install with no api_v2 at a backend that isn't there.
  test('a legacy browser value reads as none, from either source', () => {
    expect(resolveTtsBackend({ storage: store({ 'luna:tts-backend': 'browser' }), config: {} })).toBe('none');
    expect(resolveTtsBackend({ storage: store({}), config: { ttsBackend: 'browser' } })).toBe('none');
    expect(resolveTtsBackend({ storage: store({ 'luna:tts-backend': 'browser' }), config: { ttsBackend: 'http' } })).toBe('none');
  });

  test('an unknown value falls through to silence', () => {
    expect(resolveTtsBackend({ storage: store({ 'luna:tts-backend': 'espeak' }), config: {} })).toBe('none');
  });
});
