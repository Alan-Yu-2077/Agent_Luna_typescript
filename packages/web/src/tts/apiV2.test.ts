import { describe, expect, test } from 'bun:test';
import { planTtsForward, readTtsEnv } from './apiV2';

const ENV = { url: 'http://127.0.0.1:9880', refAudio: '/voice/ref.wav', promptText: 'hi', textLang: 'en' };

describe('planTtsForward', () => {
  test('speak → api_v2 POST /tts with the BYO voice params', () => {
    const plan = planTtsForward('speak', JSON.stringify({ text: 'hello' }), ENV);
    expect(plan.kind).toBe('speak');
    if (plan.kind !== 'speak') return;
    expect(plan.url).toBe('http://127.0.0.1:9880/tts');
    const body = JSON.parse(plan.body) as Record<string, unknown>;
    expect(body['text']).toBe('hello');
    expect(body['ref_audio_path']).toBe('/voice/ref.wav');
    expect(body['text_lang']).toBe('en');
    expect(body['prompt_text']).toBe('hi');
    expect(body['prompt_lang']).toBe('en'); // defaults to text_lang
  });

  test('trailing slashes on the base url are trimmed', () => {
    const plan = planTtsForward('speak', JSON.stringify({ text: 'x' }), { ...ENV, url: 'http://h:9880/' });
    expect(plan.kind === 'speak' && plan.url).toBe('http://h:9880/tts');
  });

  test('health → reachability probe of the base', () => {
    const plan = planTtsForward('health', '', ENV);
    expect(plan).toEqual({ kind: 'health', url: 'http://127.0.0.1:9880' });
  });

  test('no LUNA_TTS_URL → 502 (not configured)', () => {
    expect(planTtsForward('health', '', {})).toEqual({ kind: 'error', status: 502, message: 'tts upstream not configured' });
  });

  test('speak with no ref audio → 502', () => {
    const plan = planTtsForward('speak', JSON.stringify({ text: 'x' }), { url: 'http://h:9880' });
    expect(plan).toEqual({ kind: 'error', status: 502, message: 'LUNA_TTS_REF_AUDIO not set' });
  });

  test('empty text → 400', () => {
    expect(planTtsForward('speak', JSON.stringify({ text: '   ' }), ENV)).toEqual({ kind: 'error', status: 400, message: 'empty text' });
  });

  test('invalid json body → 400', () => {
    expect(planTtsForward('speak', '{not json', ENV)).toEqual({ kind: 'error', status: 400, message: 'invalid json' });
  });

  test('unknown subpath (incl. traversal attempts) → 404, never forwarded', () => {
    expect(planTtsForward('..%2fadmin', '', ENV)).toEqual({ kind: 'error', status: 404, message: 'unknown tts endpoint' });
    expect(planTtsForward('voices', '', ENV)).toEqual({ kind: 'error', status: 404, message: 'unknown tts endpoint' });
  });

  test('readTtsEnv maps the LUNA_TTS_* vars', () => {
    expect(readTtsEnv({ LUNA_TTS_URL: 'http://h', LUNA_TTS_REF_AUDIO: '/r.wav' })).toEqual({
      url: 'http://h',
      refAudio: '/r.wav',
      promptText: undefined,
      textLang: undefined,
      promptLang: undefined,
    });
  });
});
