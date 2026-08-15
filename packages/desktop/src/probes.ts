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
  if (!base || !fields.apiKey) return { ok: false, error: '请填写记忆向量接口地址和 API 密钥。' };
  try {
    const res = await doFetch(`${base}/v1/embeddings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${fields.apiKey}` },
      body: JSON.stringify({ model: fields.model, input: ['hi'] }),
    });
    if (res.status < 300) return { ok: true };
    if (res.status === 401 || res.status === 403)
      return { ok: false, error: '记忆向量 API 密钥被拒绝了——请到服务商控制台检查。' };
    if (res.status === 404)
      return { ok: false, error: '找不到记忆向量接口或模型——请检查接口地址和模型名称。' };
    return { ok: false, error: `记忆向量服务返回了 ${res.status}。` };
  } catch {
    return { ok: false, error: '无法访问记忆向量接口地址——请检查地址。' };
  }
}

// Tavily — the shipped web_search provider (packages/server/src/tools/web/tavily.ts). One cheap
// 1-result query proves the key.
export async function probeSearch(
  fields: { apiKey: string },
  doFetch: ProbeFetch = realFetch,
): Promise<ProbeVerdict> {
  if (!fields.apiKey) return { ok: false, error: '请填写 Tavily API 密钥。' };
  try {
    const res = await doFetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${fields.apiKey}` },
      body: JSON.stringify({ query: 'ping', max_results: 1, search_depth: 'basic' }),
    });
    if (res.status < 300) return { ok: true };
    if (res.status === 401 || res.status === 403 || res.status === 432)
      return { ok: false, error: 'Tavily 拒绝了这个密钥——请到 app.tavily.com 检查。' };
    return {
      ok: false,
      error: `Tavily 返回了 ${res.status}——请到 app.tavily.com 检查密钥和套餐。`,
    };
  } catch {
    return { ok: false, error: '无法访问 api.tavily.com——请检查网络。' };
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
  const host = fields.apiHost
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
  if (!fields.apiKey || !host) return { ok: false, error: '请填写和风天气密钥和账户 API 主机。' };
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*\.(qweatherapi\.com|qweather\.com)$/i.test(host)) {
    return {
      ok: false,
      error:
        '这不像是和风天气 API 主机（应为 xxxx.qweatherapi.com，请到 console.qweather.com → 设置查看）。',
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
      return { ok: false, error: '和风天气拒绝了这个密钥——请到控制台（dev.qweather.com）检查。' };
    if (res.status === 404 || body.includes('Invalid Host'))
      return {
        ok: false,
        error: 'API 主机不正确——请使用账户专属主机（xxxx.qweatherapi.com），不要使用旧版 devapi。',
      };
    return { ok: false, error: `和风天气返回了 ${code || res.status}。` };
  } catch {
    return { ok: false, error: '无法访问这个 API 主机——请检查是否有拼写错误。' };
  }
}
