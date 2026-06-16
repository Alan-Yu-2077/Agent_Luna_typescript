import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type Anthropic from '@anthropic-ai/sdk';
import type { ServerEvent } from '@luna/protocol';
import { MockProvider } from '../../provider/mock';
import type { ProviderEvent } from '../../provider/types';
import { messageRegistry, type ToolRegistry } from '../registry';
import { webSearchTool } from './web_search';
import { webFetchTool } from './web_fetch';
import { setWebSearchProvider } from './provider';
import { setWebFetcher } from './web_fetch';
import { getSession, resetSessions } from '../../turn/session';
import { runTurn, buildSystemPrompt } from '../../turn/runTurn';

const webRegistry: ToolRegistry = {
  ...messageRegistry,
  web_search: webSearchTool,
  web_fetch: webFetchTool,
};

function toolUseRound(id: string, name: string, input: unknown): ProviderEvent[] {
  return [
    {
      kind: 'message_stop',
      stopReason: 'tool_use',
      toolUses: [{ id, name, input }],
      assistantContent: [
        { type: 'tool_use', id, name, input },
      ] as unknown as Anthropic.ContentBlock[],
      usage: { input_tokens: 5, output_tokens: 5 },
    },
  ];
}

const endRound: ProviderEvent[] = [
  {
    kind: 'message_stop',
    stopReason: 'end_turn',
    toolUses: [],
    assistantContent: [] as unknown as Anthropic.ContentBlock[],
    usage: { input_tokens: 1, output_tokens: 1 },
  },
];

const savedTrace = Bun.env['LUNA_TRACE'];
const savedKey = Bun.env['LUNA_WEB_SEARCH_API_KEY'];

beforeEach(() => {
  resetSessions();
  Bun.env['LUNA_TRACE'] = '0';
  Bun.env['LUNA_WEB_SEARCH_API_KEY'] = 'test-key';
});

afterEach(() => {
  setWebSearchProvider(null);
  setWebFetcher(null);
  if (savedTrace === undefined) delete Bun.env['LUNA_TRACE'];
  else Bun.env['LUNA_TRACE'] = savedTrace;
  if (savedKey === undefined) delete Bun.env['LUNA_WEB_SEARCH_API_KEY'];
  else Bun.env['LUNA_WEB_SEARCH_API_KEY'] = savedKey;
});

describe('search → fetch → reason loop + citations (v0.18.2)', () => {
  test('a turn that searches then fetches surfaces deduped citations on turn.result', async () => {
    setWebSearchProvider({
      name: 'stub',
      search: async () => [
        { title: 'Alpha', url: 'https://a.example/x', snippet: 's1' },
        { title: 'Beta', url: 'https://b.example/y', snippet: 's2' },
      ],
    });
    setWebFetcher(async () => ({
      status: 200,
      contentType: 'text/html',
      body: '<html><body><article><p>the fetched page body has enough words to extract cleanly here</p></article></body></html>',
      finalUrl: 'https://a.example/x',
    }));

    const provider = new MockProvider([
      toolUseRound('s1', 'web_search', { query: 'latest news', max_results: 2 }),
      toolUseRound('f1', 'web_fetch', { url: 'https://a.example/x' }),
      toolUseRound('m1', 'message', { text: 'here is what I found', is_final: true }),
      endRound,
    ]);

    const events: ServerEvent[] = [];
    await runTurn({
      session: getSession('loop'),
      turnId: 't1',
      userText: 'what happened today?',
      provider,
      registry: webRegistry,
      emit: (e) => events.push(e),
    });

    const result = events.find((e) => e.type === 'turn.result');
    expect(result).toBeDefined();
    const citations = (result as { citations?: { url: string }[] }).citations ?? [];
    const urls = citations.map((c) => c.url).sort();
    // a.example/x from BOTH the search result and the fetch final_url → deduped to one
    expect(urls).toEqual(['https://a.example/x', 'https://b.example/y']);
  });
});

describe('standing untrusted-content injection rule (v0.18.2)', () => {
  function systemText(webSearch: boolean, webFetch: boolean): string {
    const block = buildSystemPrompt(getSession('sp'), true, webSearch, webFetch);
    return (block[0] as { text: string }).text;
  }

  test('the rule + web clauses appear only when a web tool is mounted', () => {
    const withWeb = systemText(true, true);
    expect(withWeb).toContain('Web content safety');
    expect(withWeb).toContain('<untrusted_content>');
    expect(withWeb).toContain('search the live web'); // web_search L1 clause
    expect(withWeb).toContain('read a page with web_fetch'); // web_fetch L1 clause

    const noWeb = systemText(false, false);
    expect(noWeb).not.toContain('Web content safety');
    expect(noWeb).not.toContain('read a page with web_fetch');
  });
});
