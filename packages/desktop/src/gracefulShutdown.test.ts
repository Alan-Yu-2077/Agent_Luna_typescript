import { describe, expect, test } from 'bun:test';
import { postShutdown } from './gracefulShutdown';

describe('postShutdown (v0.38.5)', () => {
  test('POSTs /shutdown to the loopback port and returns true on a 2xx', async () => {
    let seen: { url: string; method?: string } | null = null;
    const fetchFn = ((url: string, init?: { method?: string }) => {
      seen = { url, method: init?.method };
      return Promise.resolve(new Response('shutting down', { status: 200 }));
    }) as unknown as typeof fetch;
    expect(await postShutdown(8790, 1000, fetchFn)).toBe(true);
    expect(seen!.url).toBe('http://127.0.0.1:8790/shutdown');
    expect(seen!.method).toBe('POST');
  });

  test('a non-2xx response → false (caller proceeds to the hard kill)', async () => {
    const fetchFn = (() => Promise.resolve(new Response('no', { status: 404 }))) as unknown as typeof fetch;
    expect(await postShutdown(8790, 1000, fetchFn)).toBe(false);
  });

  test('a dead/absent/slow upstream (throw) → false, never rejects', async () => {
    const fetchFn = (() => Promise.reject(new Error('ECONNREFUSED'))) as unknown as typeof fetch;
    expect(await postShutdown(8790, 1000, fetchFn)).toBe(false);
  });
});
