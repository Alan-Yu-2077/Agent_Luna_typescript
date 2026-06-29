import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { ProviderEvent, ProviderRequest } from '../types';
import { OpenAIProvider, setOpenAIStreamFetcher } from './openaiProvider';

function injectChunks(...items: unknown[]): void {
  setOpenAIStreamFetcher(async function* () {
    for (const it of items) yield it;
  });
}

const req: ProviderRequest = {
  system: 'sys',
  messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
  tools: [{ name: 'read_file', description: 'r', input_schema: { type: 'object', properties: {} } }],
};

async function collect(): Promise<ProviderEvent[]> {
  const out: ProviderEvent[] = [];
  for await (const e of new OpenAIProvider({ apiKey: 'k' }).chatStream(req)) out.push(e);
  return out;
}

const textOf = (events: ProviderEvent[]): string[] =>
  events.flatMap((e) => (e.kind === 'text_delta' ? [e.text] : []));
const argsOf = (events: ProviderEvent[]): string =>
  events.flatMap((e) => (e.kind === 'tool_input_delta' ? [e.partial_json] : [])).join('');

describe('OpenAIProvider SSE streaming (v0.23.2)', () => {
  beforeEach(() => {
    Bun.env['LUNA_OPENAI_STREAM'] = '1';
  });
  afterEach(() => {
    delete Bun.env['LUNA_OPENAI_STREAM'];
    setOpenAIStreamFetcher(null);
  });

  test('text-only stream → ordered text_delta then message_stop (usage from trailing chunk)', async () => {
    injectChunks(
      { choices: [{ delta: { content: 'hel' }, finish_reason: null }] },
      { choices: [{ delta: { content: 'lo' }, finish_reason: 'stop' }] },
      { choices: [], usage: { prompt_tokens: 5, completion_tokens: 2 } },
    );
    const events = await collect();
    expect(textOf(events)).toEqual(['hel', 'lo']);
    const stop = events.at(-1);
    expect(stop?.kind).toBe('message_stop');
    if (stop?.kind === 'message_stop') {
      expect(stop.assistantContent).toEqual([{ type: 'text', text: 'hello' }]);
      expect(stop.usage).toEqual({ input_tokens: 5, output_tokens: 2 });
      expect(stop.stopReason).toBe('end_turn');
      expect(stop.toolUses).toEqual([]);
    }
  });

  test('a tool call streams: tool_use_start, fragmented args reassemble, message_stop', async () => {
    injectChunks(
      { choices: [{ delta: { tool_calls: [{ index: 0, id: 'c1', function: { name: 'read_file', arguments: '{"pa' } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'th":"README.md"}' } }] } }] },
      { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
    );
    const events = await collect();
    const start = events.find((e) => e.kind === 'tool_use_start');
    expect(start?.kind).toBe('tool_use_start');
    if (start?.kind === 'tool_use_start') {
      expect(start.id).toBe('c1');
      expect(start.name).toBe('read_file');
    }
    expect(argsOf(events)).toBe('{"path":"README.md"}'); // fragments reassemble to valid JSON
    const stop = events.find((e) => e.kind === 'message_stop');
    if (stop?.kind === 'message_stop') {
      expect(stop.toolUses).toEqual([{ id: 'c1', name: 'read_file', input: { path: 'README.md' } }]);
      expect(stop.assistantContent).toEqual([
        { type: 'tool_use', id: 'c1', name: 'read_file', input: { path: 'README.md' } },
      ]);
      expect(stop.stopReason).toBe('tool_use');
    }
  });

  test('reasoning delta → thinking_delta', async () => {
    injectChunks(
      { choices: [{ delta: { reasoning: 'let me think' } }] },
      { choices: [{ delta: { content: 'answer' }, finish_reason: 'stop' }] },
    );
    const events = await collect();
    expect(events.some((e) => e.kind === 'thinking_delta' && e.text === 'let me think')).toBe(true);
    // reasoning_content (the alternate field name) also maps
    injectChunks({ choices: [{ delta: { reasoning_content: 'hmm' }, finish_reason: 'stop' }] });
    const events2 = await collect();
    expect(events2.some((e) => e.kind === 'thinking_delta' && e.text === 'hmm')).toBe(true);
  });

  test('interleaving: text → tool call → text (NOT buffered to the end)', async () => {
    injectChunks(
      { choices: [{ delta: { content: 'thinking... ' } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, id: 'c1', function: { name: 't', arguments: '{}' } }] } }] },
      { choices: [{ delta: { content: 'done' }, finish_reason: 'stop' }] },
    );
    const kinds = (await collect()).map((e) => e.kind);
    expect(kinds.indexOf('text_delta')).toBeLessThan(kinds.indexOf('tool_use_start'));
    expect(kinds.lastIndexOf('text_delta')).toBeGreaterThan(kinds.indexOf('tool_use_start'));
    expect(kinds.at(-1)).toBe('message_stop');
  });

  test('two tool calls at different indices both surface, in index order', async () => {
    injectChunks(
      { choices: [{ delta: { tool_calls: [{ index: 0, id: 'a', function: { name: 'f', arguments: '{}' } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 1, id: 'b', function: { name: 'g', arguments: '{}' } }] } }] },
      { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
    );
    const stop = (await collect()).find((e) => e.kind === 'message_stop');
    if (stop?.kind === 'message_stop') {
      expect(stop.toolUses).toEqual([
        { id: 'a', name: 'f', input: {} },
        { id: 'b', name: 'g', input: {} },
      ]);
    }
  });

  test('tool calls but NO terminal finish_reason chunk → stopReason still tool_use (so runTurn dispatches)', async () => {
    injectChunks(
      { choices: [{ delta: { tool_calls: [{ index: 0, id: 'c1', function: { name: 'f', arguments: '{}' } }] } }] },
      // no trailing { finish_reason: 'tool_calls' } chunk (non-conformant gateway)
    );
    const stop = (await collect()).find((e) => e.kind === 'message_stop');
    expect(stop?.kind).toBe('message_stop');
    if (stop?.kind === 'message_stop') {
      expect(stop.stopReason).toBe('tool_use'); // defaulted because a tool was accumulated
      expect(stop.toolUses).toEqual([{ id: 'c1', name: 'f', input: {} }]);
    }
  });

  test('arguments arriving before id/name still reassemble (buffered flush on start)', async () => {
    injectChunks(
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"a"' } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, id: 'c9', function: { name: 'f', arguments: ':1}' } }] } }] },
      { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
    );
    const events = await collect();
    expect(argsOf(events)).toBe('{"a":1}');
    const stop = events.find((e) => e.kind === 'message_stop');
    if (stop?.kind === 'message_stop') {
      expect(stop.toolUses).toEqual([{ id: 'c9', name: 'f', input: { a: 1 } }]);
    }
  });

  // ── v0.23.4 hardening ──
  test('a malformed chunk is skipped (safeParse), the turn still completes', async () => {
    injectChunks(
      { choices: 'not-an-array' }, // fails the schema → skipped, not a crash
      { choices: [{ delta: { content: 'hi' }, finish_reason: 'stop' }] },
    );
    const events = await collect();
    expect(textOf(events)).toEqual(['hi']);
    expect(events.at(-1)?.kind).toBe('message_stop');
  });

  test('a tool-call delta with NO id gets a synthesized stable call_<index> id', async () => {
    injectChunks(
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { name: 'f', arguments: '{}' } }] } }] },
      { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
    );
    const stop = (await collect()).find((e) => e.kind === 'message_stop');
    if (stop?.kind === 'message_stop') {
      expect(stop.toolUses).toEqual([{ id: 'call_0', name: 'f', input: {} }]); // not id:''
    }
  });

  test('an in-band error frame throws (not silently swallowed) — object or string shape', async () => {
    injectChunks({ error: { message: 'rate limited' } });
    await expect(collect()).rejects.toThrow(/rate limited/);
    injectChunks({ error: 'upstream overloaded' }); // bare-string error frame (non-conformant gateway)
    await expect(collect()).rejects.toThrow(/upstream overloaded/);
  });
});
