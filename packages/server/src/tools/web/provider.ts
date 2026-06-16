import { tavilyProvider } from './tavily';

// A single search result, provider-normalized (Initiative 11, v0.18.0). The
// `WebSearchProvider` abstraction (port of Python's `WebSearchProvider`
// Protocol) keeps Tavily from leaking into the tool: Brave/Exa/Sonar — or
// Anthropic's native `web_search` if Luna ever runs against first-party API —
// drop in as one more `getProvider` case.
export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  score?: number;
  ageHint?: string;
};

export type SearchOptions = {
  maxResults: number;
  timeRange?: 'day' | 'week' | 'month' | 'year';
  includeDomains?: string[];
  excludeDomains?: string[];
};

export interface WebSearchProvider {
  readonly name: string;
  // Receives ctx.abortSignal so the dispatcher's timeoutMs cancels the fetch.
  // Throws on any transport/HTTP failure — web_search.ts catches and soft-fails.
  search(query: string, opts: SearchOptions, signal: AbortSignal): Promise<SearchResult[]>;
}

// Provider dispatch. 'tavily' is the default (Python parity). An unknown name
// throws; web_search.ts catches it and returns a recoverable err rather than
// crashing the turn.
export function getProvider(name: string): WebSearchProvider {
  switch (name) {
    case 'tavily':
      return tavilyProvider;
    default:
      throw new Error(`unknown web search provider: ${name}`);
  }
}

// Test seam (mirrors memory/sessionStore's setMemoryDb): inject a stub provider
// so unit tests never touch the network. Passing null clears the override and
// restores env-driven resolution.
let override: WebSearchProvider | null = null;

export function setWebSearchProvider(provider: WebSearchProvider | null): void {
  override = provider;
}

export function resolveProvider(): WebSearchProvider {
  if (override) return override;
  return getProvider(Bun.env['LUNA_WEB_SEARCH_PROVIDER'] ?? 'tavily');
}
