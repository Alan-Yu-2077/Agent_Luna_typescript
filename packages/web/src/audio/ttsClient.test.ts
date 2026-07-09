import { afterEach, describe, expect, test } from 'bun:test';
import { fetchSpeech } from './ttsClient';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('fetchSpeech', () => {
  test('POSTs the text to <base>/speak and returns the audio bytes', async () => {
    let captured: { url: unknown; init?: RequestInit } | undefined;
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      captured = { url, init };
      return new Response(new ArrayBuffer(8), { status: 200 });
    }) as unknown as typeof fetch; // test stub: minimal fetch shape (no preconnect)

    const buf = await fetchSpeech('你好'); // default base is /api/tts
    expect(buf.byteLength).toBe(8);
    expect(String(captured?.url)).toContain('/api/tts/speak');
    expect(JSON.parse(String(captured?.init?.body)).text).toBe('你好');
  });

  test('throws when the sidecar returns non-200', async () => {
    globalThis.fetch = (async () => new Response('down', { status: 502 })) as unknown as typeof fetch; // test stub
    await expect(fetchSpeech('hi')).rejects.toThrow();
  });
});
