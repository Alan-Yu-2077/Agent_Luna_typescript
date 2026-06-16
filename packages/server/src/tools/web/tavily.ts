import type { SearchOptions, SearchResult, WebSearchProvider } from './provider';

// Default search provider (Initiative 11, v0.18.0). Mirrors the embed.ts fetch
// discipline (LD #13): a minimal `fetch` client, env base/key, AbortSignal
// threaded for free timeout/cancel, and error bodies sliced to ~200 chars so a
// failing endpoint never leaks the full payload into a trace or the model.
const TAVILY_URL = 'https://api.tavily.com/search';

function resultChars(): number {
  return Number(Bun.env['LUNA_WEB_SEARCH_RESULT_CHARS'] ?? 800);
}

type TavilyResult = {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
  published_date?: string;
};

type TavilyResponse = { results?: TavilyResult[] };

export const tavilyProvider: WebSearchProvider = {
  name: 'tavily',
  async search(query: string, opts: SearchOptions, signal: AbortSignal): Promise<SearchResult[]> {
    const key = Bun.env['LUNA_WEB_SEARCH_API_KEY'] ?? '';
    const body: Record<string, unknown> = {
      query,
      max_results: opts.maxResults,
      search_depth: 'basic',
    };
    if (opts.timeRange) body['time_range'] = opts.timeRange;
    if (opts.includeDomains && opts.includeDomains.length > 0) {
      body['include_domains'] = opts.includeDomains;
    }
    if (opts.excludeDomains && opts.excludeDomains.length > 0) {
      body['exclude_domains'] = opts.excludeDomains;
    }

    const res = await fetch(TAVILY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) {
      throw new Error(`tavily ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const json = (await res.json()) as TavilyResponse;
    const cap = resultChars();
    return (json.results ?? []).map((r) => {
      const result: SearchResult = {
        title: r.title ?? '',
        url: r.url ?? '',
        snippet: (r.content ?? '').slice(0, cap),
      };
      if (typeof r.score === 'number') result.score = r.score;
      if (typeof r.published_date === 'string') result.ageHint = r.published_date;
      return result;
    });
  },
};
