import { z } from 'zod';
import { defineTool } from '../defineTool';
import { resolveProvider, type WebSearchProvider } from './provider';

// web_search (Initiative 11, v0.18.0) — Luna's "look it up" capability. A
// client-side live-web search on the existing dispatcher (LD #9: an ordinary
// side-effect tool, no special-casing), inheriting timeout/abort/tracing for
// free. Read-only ⇒ proactiveRisk:'safe' (LD #15 lists searches as silent-OK).
// Default OFF behind LUNA_WEB_SEARCH; flipped on in v0.18.2 after cost is
// measured. The yunwu gateway strips Anthropic's native web_search, so this is
// implemented in Luna's backend behind a provider abstraction.

const Input = z.object({
  query: z
    .string()
    .min(2)
    .max(400)
    .describe('what to search the live web for, in natural language'),
  max_results: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(5)
    .describe('how many results to return (1–10, default 5)'),
  time_range: z
    .enum(['day', 'week', 'month', 'year'])
    .optional()
    .describe('restrict results to a recency window'),
  include_domains: z
    .array(z.string())
    .max(10)
    .optional()
    .describe('only return results from these domains'),
  exclude_domains: z
    .array(z.string())
    .max(10)
    .optional()
    .describe('never return results from these domains'),
});

const ResultItem = z.object({
  title: z.string(),
  url: z.string(),
  snippet: z.string(),
  score: z.number().optional(),
  age_hint: z.string().optional(),
});

const Output = z.object({
  query: z.string(),
  results: z.array(ResultItem),
  provider: z.string(),
  ts: z.number().int().nonnegative(),
});

function timeoutMs(): number {
  return Number(Bun.env['LUNA_WEB_SEARCH_TIMEOUT_MS'] ?? 15000);
}

export const webSearchTool = defineTool({
  name: 'web_search',
  description:
    'Search the live web for current information. Reach for it when you need a fact newer than ' +
    'your training, a specific current detail (news, prices, schedules, docs), or when the user ' +
    'asks you to look something up — but prefer recall first for things you may already know. ' +
    'Returns ranked results with title, url, and a snippet; cite the urls you actually use.',
  input: Input,
  output: Output,
  concurrency: 'safe-parallel',
  proactiveRisk: 'safe',
  timeoutMs: timeoutMs(),
  summarize: (out) => {
    const cites = out.results.map((r, i) => `[${i + 1}] ${r.url}`).join('; ');
    const n = out.results.length;
    return `${n} result${n === 1 ? '' : 's'} for "${out.query}"${cites ? `: ${cites}` : ''}`;
  },
  execute: async function* (input, ctx) {
    // The Python interim_message_for hook → a tool.progress line so the UI shows
    // "正在查一下…" during the blocking 1–3 s network call instead of a stall.
    yield { kind: 'progress', payload: { note: `正在查一下: ${input.query.slice(0, 40)}…` } };

    // Soft-fail discipline (port Python's): every failure is a recoverable err
    // the model can describe — nothing throws past this generator. An unset key
    // is a config gap, not a crash. (ToolErrorCode has no 'no_api_key' member, so
    // the reason rides the message; recoverable:true tells the model it may say
    // it cannot search right now.)
    if ((Bun.env['LUNA_WEB_SEARCH_API_KEY'] ?? '').length === 0) {
      yield {
        kind: 'err',
        code: 'execution_exception',
        message: 'no_api_key: LUNA_WEB_SEARCH_API_KEY is not set',
        recoverable: true,
      };
      return;
    }

    if (ctx.abortSignal.aborted) {
      yield { kind: 'err', code: 'aborted', message: 'web_search aborted', recoverable: true };
      return;
    }

    let provider: WebSearchProvider;
    try {
      provider = resolveProvider();
    } catch (e) {
      yield {
        kind: 'err',
        code: 'execution_exception',
        message: e instanceof Error ? e.message : String(e),
        recoverable: true,
      };
      return;
    }

    try {
      const results = await provider.search(
        input.query,
        {
          maxResults: input.max_results,
          ...(input.time_range ? { timeRange: input.time_range } : {}),
          ...(input.include_domains ? { includeDomains: input.include_domains } : {}),
          ...(input.exclude_domains ? { excludeDomains: input.exclude_domains } : {}),
        },
        ctx.abortSignal,
      );
      yield {
        kind: 'ok',
        data: {
          query: input.query,
          results: results.map((r) => ({
            title: r.title,
            url: r.url,
            snippet: r.snippet,
            ...(r.score !== undefined ? { score: r.score } : {}),
            ...(r.ageHint !== undefined ? { age_hint: r.ageHint } : {}),
          })),
          provider: provider.name,
          ts: Date.now(),
        },
      };
    } catch (e) {
      // A timeout fires as an abort on ctx.abortSignal; surface it as 'aborted'
      // so the model can distinguish a slow network from a real provider error.
      yield {
        kind: 'err',
        code: ctx.abortSignal.aborted ? 'aborted' : 'execution_exception',
        message: e instanceof Error ? e.message : String(e),
        recoverable: true,
      };
    }
  },
});
