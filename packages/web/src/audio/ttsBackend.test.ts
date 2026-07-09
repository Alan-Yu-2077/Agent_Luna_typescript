import { describe, expect, test } from 'bun:test';
import { resolveTtsBackend } from './ttsBackend';

const store = (m: Record<string, string>): Pick<Storage, 'getItem'> => ({ getItem: (k) => m[k] ?? null });

describe('resolveTtsBackend', () => {
  test('defaults to browser (zero-setup voice) when nothing is set', () => {
    expect(resolveTtsBackend({ storage: store({}), config: {} })).toBe('browser');
    expect(resolveTtsBackend({ storage: null, config: undefined })).toBe('browser');
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

  test('storage overrides the injected config', () => {
    expect(resolveTtsBackend({ storage: store({ 'luna:tts-backend': 'browser' }), config: { ttsBackend: 'http' } })).toBe('browser');
  });

  test('an unknown value falls through to the browser default', () => {
    expect(resolveTtsBackend({ storage: store({ 'luna:tts-backend': 'espeak' }), config: {} })).toBe('browser');
  });
});
