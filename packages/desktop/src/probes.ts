// v0.35.1 (Initiative 25): live provider probes for the wizard's optional steps — a real, minimal
// request to the actual vendor, classified into a plain-language verdict with the vendor-specific
// fix. Pure + fetch-injectable (the qweather.ts test-seam pattern) so every branch unit-tests
// offline. Key custody: keys ride in, verdicts ride out — no verdict ever contains an input value.

import type { ProbeVerdict } from './onboarding';

export type ProbeResponse = { status: number; text(): Promise<string> };
export type ProbeFetch = (url: string, init?: RequestInit) => Promise<ProbeResponse>;

const realFetch: ProbeFetch = (url, init) => fetch(url, init);

// OpenAI-compatible /v1/embeddings — the exact endpoint shape the sidecar uses at runtime
// (packages/server/src/memory/recall/embed.ts). A 1-input request is the cheapest authenticated call.
export async function probeEmbedding(
  fields: { baseUrl: string; apiKey: string; model: string },
  doFetch: ProbeFetch = realFetch,
): Promise<ProbeVerdict> {
  const base = fields.baseUrl.trim().replace(/\/+$/, '');
  if (!base || !fields.apiKey) return { ok: false, error: 'Enter an embedding base URL and API key.' };
  try {
    const res = await doFetch(`${base}/v1/embeddings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${fields.apiKey}` },
      body: JSON.stringify({ model: fields.model, input: ['hi'] }),
    });
    if (res.status < 300) return { ok: true };
    if (res.status === 401 || res.status === 403)
      return { ok: false, error: 'The embedding API key was rejected — check it on your provider console.' };
    if (res.status === 404)
      return { ok: false, error: 'Embeddings endpoint or model not found — check the base URL and model name.' };
    return { ok: false, error: `The embedding server returned ${res.status}.` };
  } catch {
    return { ok: false, error: "Couldn't reach the embedding base URL — check it." };
  }
}

// Tavily — the shipped web_search provider (packages/server/src/tools/web/tavily.ts). One cheap
// 1-result query proves the key.
export async function probeSearch(
  fields: { apiKey: string },
  doFetch: ProbeFetch = realFetch,
): Promise<ProbeVerdict> {
  if (!fields.apiKey) return { ok: false, error: 'Enter a Tavily API key.' };
  try {
    const res = await doFetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${fields.apiKey}` },
      body: JSON.stringify({ query: 'ping', max_results: 1, search_depth: 'basic' }),
    });
    if (res.status < 300) return { ok: true };
    if (res.status === 401 || res.status === 403 || res.status === 432)
      return { ok: false, error: 'Tavily rejected this key — check it at app.tavily.com.' };
    return { ok: false, error: `Tavily returned ${res.status} — check your key/plan at app.tavily.com.` };
  } catch {
    return { ok: false, error: "Couldn't reach api.tavily.com — check your network." };
  }
}

// QWeather — needs the key AND the per-account API host (post-2024 keys get a dedicated
// xxxx.qweatherapi.com; the legacy shared hosts answer "Invalid Host" — see
// packages/server/src/tools/web/weather/qweather.ts). Probes a fixed city id (Beijing) so no user
// location is touched before consent. The host is validated BEFORE any fetch — this probe must not
// be usable as an arbitrary-URL request primitive.
export async function probeWeather(
  fields: { apiKey: string; apiHost: string },
  doFetch: ProbeFetch = realFetch,
): Promise<ProbeVerdict> {
  const host = fields.apiHost.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  if (!fields.apiKey || !host) return { ok: false, error: 'Enter a QWeather key and your account API host.' };
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*\.(qweatherapi\.com|qweather\.com)$/i.test(host)) {
    return {
      ok: false,
      error: 'That does not look like a QWeather API host (expected xxxx.qweatherapi.com — see console.qweather.com → Settings).',
    };
  }
  try {
    const res = await doFetch(
      `https://${host}/v7/weather/now?location=101010100&key=${encodeURIComponent(fields.apiKey)}`,
      { method: 'GET' },
    );
    const body = await res.text();
    let code = '';
    try {
      code = String((JSON.parse(body) as { code?: unknown }).code ?? '');
    } catch {
      /* non-JSON body — fall through to status classification */
    }
    if (res.status < 300 && code === '200') return { ok: true };
    if (res.status === 401 || res.status === 403 || code === '401' || code === '403')
      return { ok: false, error: 'QWeather rejected this key — check it in the console (dev.qweather.com).' };
    if (res.status === 404 || body.includes('Invalid Host'))
      return {
        ok: false,
        error: 'Wrong API host — use your account\'s dedicated host (xxxx.qweatherapi.com), not the legacy devapi.',
      };
    return { ok: false, error: `QWeather returned ${code || res.status}.` };
  } catch {
    return { ok: false, error: "Couldn't reach that API host — check it for typos." };
  }
}
