import { describe, expect, test } from 'bun:test';
import { probeEmbedding, probeSearch, probeWeather, type ProbeFetch } from './probes';

const KEY = 'sk-secret-do-not-echo';

function fetcher(status: number, body = '{}'): { fn: ProbeFetch; calls: Array<{ url: string; init?: RequestInit }> } {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fn: ProbeFetch = (url, init) => {
    calls.push({ url, init });
    return Promise.resolve({ status, text: () => Promise.resolve(body) });
  };
  return { fn, calls };
}

const throwing: ProbeFetch = () => Promise.reject(new Error('ENOTFOUND'));

describe('probeEmbedding (v0.35.1)', () => {
  const fields = { baseUrl: 'https://api.openai.com/', apiKey: KEY, model: 'text-embedding-3-large' };

  test('2xx → ok, and the request hits {base}/v1/embeddings with the model', async () => {
    const { fn, calls } = fetcher(200);
    expect((await probeEmbedding(fields, fn)).ok).toBe(true);
    expect(calls[0]?.url).toBe('https://api.openai.com/v1/embeddings');
    expect(String(calls[0]?.init?.body)).toContain('text-embedding-3-large');
  });
  test('401 → key-rejected message naming the provider console', async () => {
    const v = await probeEmbedding(fields, fetcher(401).fn);
    expect(v.ok).toBe(false);
    expect(v.error).toContain('key');
  });
  test('404 → base URL / model hint', async () => {
    const v = await probeEmbedding(fields, fetcher(404).fn);
    expect(v.error).toContain('base URL');
  });
  test('thrown fetch → unreachable hint; empty fields → prompt without fetching', async () => {
    expect((await probeEmbedding(fields, throwing)).error).toContain('reach');
    const { fn, calls } = fetcher(200);
    await probeEmbedding({ baseUrl: '', apiKey: '', model: '' }, fn);
    expect(calls.length).toBe(0);
  });
  test('custody: no verdict ever contains the key', async () => {
    for (const status of [200, 401, 404, 500]) {
      const v = await probeEmbedding(fields, fetcher(status).fn);
      expect(JSON.stringify(v)).not.toContain(KEY);
    }
  });
});

describe('probeSearch', () => {
  test('2xx → ok against api.tavily.com', async () => {
    const { fn, calls } = fetcher(200);
    expect((await probeSearch({ apiKey: KEY }, fn)).ok).toBe(true);
    expect(calls[0]?.url).toBe('https://api.tavily.com/search');
  });
  test('401/432 → Tavily key message with the console URL', async () => {
    for (const status of [401, 432]) {
      const v = await probeSearch({ apiKey: KEY }, fetcher(status).fn);
      expect(v.ok).toBe(false);
      expect(v.error).toContain('app.tavily.com');
    }
  });
  test('custody + no-fetch on empty key', async () => {
    const v = await probeSearch({ apiKey: KEY }, fetcher(500).fn);
    expect(JSON.stringify(v)).not.toContain(KEY);
    const { fn, calls } = fetcher(200);
    await probeSearch({ apiKey: '' }, fn);
    expect(calls.length).toBe(0);
  });
});

describe('probeWeather', () => {
  const fields = { apiKey: KEY, apiHost: 'ab12cd.qweatherapi.com' };

  test('HTTP 200 + body code 200 → ok; probes the fixed Beijing id (no user location)', async () => {
    const { fn, calls } = fetcher(200, '{"code":"200"}');
    expect((await probeWeather(fields, fn)).ok).toBe(true);
    expect(calls[0]?.url).toContain('location=101010100');
    expect(calls[0]?.url).toContain('ab12cd.qweatherapi.com');
  });
  test('body code 401 → key hint even under HTTP 200', async () => {
    const v = await probeWeather(fields, fetcher(200, '{"code":"401"}').fn);
    expect(v.ok).toBe(false);
    expect(v.error).toContain('key');
  });
  test('Invalid Host body / 404 → the per-account API-host hint', async () => {
    const v404 = await probeWeather(fields, fetcher(404, 'nope').fn);
    expect(v404.error).toContain('host');
    const vBody = await probeWeather(fields, fetcher(200, 'Invalid Host').fn);
    expect(vBody.error).toContain('host');
  });
  test('host guard: a non-QWeather host is rejected BEFORE any fetch', async () => {
    const { fn, calls } = fetcher(200, '{"code":"200"}');
    const v = await probeWeather({ apiKey: KEY, apiHost: 'evil.example.com' }, fn);
    expect(v.ok).toBe(false);
    expect(calls.length).toBe(0);
  });
  test('protocol prefix + trailing slash are normalized, legacy qweather.com allowed', async () => {
    const { fn, calls } = fetcher(200, '{"code":"200"}');
    expect((await probeWeather({ apiKey: KEY, apiHost: 'https://devapi.qweather.com/' }, fn)).ok).toBe(true);
    expect(calls[0]?.url.startsWith('https://devapi.qweather.com/v7/')).toBe(true);
  });
  test('custody: the key never appears in a verdict', async () => {
    for (const body of ['{"code":"200"}', '{"code":"401"}', 'Invalid Host']) {
      const v = await probeWeather(fields, fetcher(200, body).fn);
      expect(JSON.stringify(v)).not.toContain(KEY);
    }
  });
});
