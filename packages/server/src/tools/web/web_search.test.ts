import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { InternalEvent, ToolContext } from '../defineTool';
import { webSearchTool } from './web_search';
import { setWebSearchProvider, type SearchResult, type WebSearchProvider } from './provider';
import { withWebSearch } from '../registry';

const saved = {
  flag: Bun.env['LUNA_WEB_SEARCH'],
  key: Bun.env['LUNA_WEB_SEARCH_API_KEY'],
  provider: Bun.env['LUNA_WEB_SEARCH_PROVIDER'],
};

function restore(name: string, value: string | undefined): void {
  if (value === undefined) delete Bun.env[name];
  else Bun.env[name] = value;
}

function ctx(signal?: AbortSignal): ToolContext {
  return { sessionId: 's', callId: 'c', abortSignal: signal ?? new AbortController().signal };
}

async function run(
  input: Record<string, unknown>,
  c: ToolContext,
): Promise<InternalEvent<unknown>[]> {
  const events: InternalEvent<unknown>[] = [];
  for await (const e of webSearchTool.execute(input, c)) events.push(e);
  return events;
}

function stub(results: SearchResult[]): WebSearchProvider {
  return { name: 'stub', search: async () => results };
}

beforeEach(() => {
  Bun.env['LUNA_WEB_SEARCH_API_KEY'] = 'test-key';
  delete Bun.env['LUNA_WEB_SEARCH_PROVIDER'];
});

afterEach(() => {
  setWebSearchProvider(null);
  restore('LUNA_WEB_SEARCH', saved.flag);
  restore('LUNA_WEB_SEARCH_API_KEY', saved.key);
  restore('LUNA_WEB_SEARCH_PROVIDER', saved.provider);
});

describe('webSearchTool — shape + summarize', () => {
  test('provider results flow to output.results; progress emitted first', async () => {
    setWebSearchProvider(
      stub([
        { title: 'T1', url: 'https://a.example', snippet: 's1', score: 0.9 },
        { title: 'T2', url: 'https://b.example', snippet: 's2' },
        { title: 'T3', url: 'https://c.example', snippet: 's3', ageHint: '2026-06-01' },
      ]),
    );
    const events = await run({ query: 'who won', max_results: 5 }, ctx());

    expect(events[0]).toEqual({
      kind: 'progress',
      payload: { note: expect.stringContaining('正在查') },
    });
    const ok = events.find((e) => e.kind === 'ok');
    expect(ok).toBeDefined();
    const data = (ok as { kind: 'ok'; data: { results: unknown[]; provider: string } }).data;
    expect(data.results.length).toBe(3);
    expect(data.provider).toBe('stub');
    expect((data.results[0] as { title: string }).title).toBe('T1');
    expect((data.results[2] as { age_hint?: string }).age_hint).toBe('2026-06-01');
    // the unscored result omits score rather than carrying undefined
    expect('score' in (data.results[1] as object)).toBe(false);
  });

  test('summarize renders the numbered [N] url citation line', () => {
    const out = {
      query: 'q',
      results: [
        { title: 'a', url: 'https://a', snippet: '' },
        { title: 'b', url: 'https://b', snippet: '' },
        { title: 'c', url: 'https://c', snippet: '' },
      ],
      provider: 'stub',
      ts: 0,
    };
    const line = webSearchTool.summarize(out);
    expect(line).toContain('3 results for "q"');
    expect(line).toContain('[1] https://a');
    expect(line).toContain('[2] https://b');
    expect(line).toContain('[3] https://c');
  });

  test('proactiveRisk is safe (may run in a silent proactive turn)', () => {
    expect(webSearchTool.proactiveRisk).toBe('safe');
    expect(webSearchTool.concurrency).toBe('safe-parallel');
  });
});

describe('webSearchTool — soft-fail (no throw escapes the generator)', () => {
  test('no API key → recoverable err, no provider call', async () => {
    delete Bun.env['LUNA_WEB_SEARCH_API_KEY'];
    let called = false;
    setWebSearchProvider({
      name: 'spy',
      search: async () => {
        called = true;
        return [];
      },
    });
    const events = await run({ query: 'x', max_results: 5 }, ctx());
    const err = events.find((e) => e.kind === 'err');
    expect(err).toMatchObject({ kind: 'err', recoverable: true });
    expect((err as { message: string }).message).toContain('no_api_key');
    expect(called).toBe(false);
  });

  test('provider throwing → recoverable err with the (sliced) message, never throws', async () => {
    setWebSearchProvider({
      name: 'boom',
      search: async () => {
        throw new Error('tavily 500: upstream exploded');
      },
    });
    let threw = false;
    let events: InternalEvent<unknown>[] = [];
    try {
      events = await run({ query: 'x', max_results: 5 }, ctx());
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
    const err = events.find((e) => e.kind === 'err');
    expect(err).toMatchObject({ kind: 'err', code: 'execution_exception', recoverable: true });
    expect((err as { message: string }).message).toContain('upstream exploded');
  });

  test('unknown provider name → recoverable err', async () => {
    setWebSearchProvider(null); // fall through to env-driven getProvider
    Bun.env['LUNA_WEB_SEARCH_PROVIDER'] = 'nope';
    const events = await run({ query: 'x', max_results: 5 }, ctx());
    const err = events.find((e) => e.kind === 'err');
    expect(err).toMatchObject({ kind: 'err', recoverable: true });
    expect((err as { message: string }).message).toContain('unknown web search provider');
  });

  test('pre-aborted signal → prompt aborted err, provider never called', async () => {
    let called = false;
    setWebSearchProvider({
      name: 'slow',
      search: async () => {
        called = true;
        return [];
      },
    });
    const ac = new AbortController();
    ac.abort('timeout');
    const events = await run({ query: 'x', max_results: 5 }, ctx(ac.signal));
    const err = events.find((e) => e.kind === 'err');
    expect(err).toMatchObject({ kind: 'err', code: 'aborted', recoverable: true });
    expect(called).toBe(false);
  });
});

describe('webSearchTool — registry gating', () => {
  test('withWebSearch mounts web_search only under LUNA_WEB_SEARCH=1', () => {
    Bun.env['LUNA_WEB_SEARCH'] = '1';
    expect(withWebSearch({}).web_search).toBeDefined();
    Bun.env['LUNA_WEB_SEARCH'] = '0';
    expect(withWebSearch({}).web_search).toBeUndefined();
    delete Bun.env['LUNA_WEB_SEARCH'];
    expect(withWebSearch({}).web_search).toBeUndefined();
  });
});
