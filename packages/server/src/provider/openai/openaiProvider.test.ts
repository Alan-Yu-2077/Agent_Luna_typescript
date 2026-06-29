import { afterEach, describe, expect, test } from 'bun:test';
import type { ProviderEvent, ProviderRequest } from '../types';
import { OpenAIProvider, setOpenAIFetcher } from './openaiProvider';

afterEach(() => setOpenAIFetcher(null));

function chatReq(): ProviderRequest {
  return {
    system: 'you are Luna',
    messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
    tools: [{ name: 'read_file', description: 'r', input_schema: { type: 'object', properties: {} } }],
  };
}

describe('OpenAIProvider (v0.23.1, injected fetcher)', () => {
  test('complete() maps content + usage and sends a system message + the user turn', async () => {
    let captured = '';
    setOpenAIFetcher(async (args) => {
      captured = JSON.stringify(args.body);
      return {
        choices: [{ message: { content: 'summary text' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 2 },
      };
    });
    const out = await new OpenAIProvider({ apiKey: 'k' }).complete({
      system: 'sys',
      messages: [{ role: 'user', content: 'do it' }],
    });
    expect(out.text).toBe('summary text');
    expect(out.usage).toEqual({ input_tokens: 5, output_tokens: 2 });
    expect(captured).toContain('"role":"system"');
    expect(captured).toContain('"content":"sys"');
    expect(captured).toContain('"content":"do it"');
  });

  test('chatStream() yields text_delta then message_stop for a text reply', async () => {
    setOpenAIFetcher(async () => ({
      choices: [{ message: { content: 'hello' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 4, completion_tokens: 1 },
    }));
    const events: ProviderEvent[] = [];
    for await (const e of new OpenAIProvider({ apiKey: 'k' }).chatStream(chatReq())) events.push(e);
    expect(events[0]).toEqual({ kind: 'text_delta', text: 'hello' });
    const stop = events.at(-1);
    expect(stop?.kind).toBe('message_stop');
    if (stop?.kind === 'message_stop') {
      expect(stop.assistantContent).toEqual([{ type: 'text', text: 'hello' }]);
      expect(stop.toolUses).toEqual([]);
      expect(stop.usage).toEqual({ input_tokens: 4, output_tokens: 1 });
    }
  });

  test('chatStream() surfaces a tool call (toolUses + assistantContent) and sends the tools', async () => {
    let captured = '';
    setOpenAIFetcher(async (args) => {
      captured = JSON.stringify(args.body);
      return {
        choices: [
          {
            message: { content: null, tool_calls: [{ id: 'c1', function: { name: 'read_file', arguments: '{"path":"README.md"}' } }] },
            finish_reason: 'tool_calls',
          },
        ],
      };
    });
    const events: ProviderEvent[] = [];
    for await (const e of new OpenAIProvider({ apiKey: 'k' }).chatStream(chatReq())) events.push(e);
    const stop = events.find((e) => e.kind === 'message_stop');
    expect(stop?.kind).toBe('message_stop');
    if (stop?.kind === 'message_stop') {
      expect(stop.toolUses).toEqual([{ id: 'c1', name: 'read_file', input: { path: 'README.md' } }]);
      expect(stop.assistantContent).toEqual([
        { type: 'tool_use', id: 'c1', name: 'read_file', input: { path: 'README.md' } },
      ]);
      expect(stop.stopReason).toBe('tool_use');
    }
    expect(captured).toContain('"type":"function"');
    expect(captured).toContain('"name":"read_file"');
  });

  test('an empty choices array throws a clear error', async () => {
    setOpenAIFetcher(async () => ({ choices: [] }));
    await expect(new OpenAIProvider({ apiKey: 'k' }).complete({ system: 's', messages: [] })).rejects.toThrow();
  });

  test('a registry entry shapes the request: developer role + max_completion_tokens (v0.23.3)', async () => {
    let captured = '';
    setOpenAIFetcher(async (args) => {
      captured = JSON.stringify(args.body);
      return { choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] };
    });
    const p = new OpenAIProvider({
      apiKey: 'k',
      entry: { id: 'o3', protocol: 'openai', tokenParam: 'max_completion_tokens', systemRole: 'developer', reasoning: true },
    });
    await p.complete({ system: 'sys', messages: [{ role: 'user', content: 'hi' }] });
    expect(captured).toContain('"role":"developer"');
    expect(captured).toContain('"max_completion_tokens"');
    expect(captured).not.toContain('"max_tokens"');
    expect(p.capabilities.thinking).toBe(true);
  });

  test('a no-tool entry omits tools from the request (v0.23.3)', async () => {
    let captured = '';
    setOpenAIFetcher(async (args) => {
      captured = JSON.stringify(args.body);
      return { choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] };
    });
    const p = new OpenAIProvider({ apiKey: 'k', entry: { id: 'x', protocol: 'openai', toolUse: false } });
    for await (const _ of p.chatStream(chatReq())) void _;
    expect(captured).not.toContain('"tools"');
    expect(p.capabilities.toolUse).toBe(false);
  });

  // ── v0.23.4 hardening ──
  test('buffered path forces a tool_use stop when tool_calls present but finish_reason is stop', async () => {
    setOpenAIFetcher(async () => ({
      choices: [
        {
          message: { content: null, tool_calls: [{ id: 'c1', function: { name: 'f', arguments: '{}' } }] },
          finish_reason: 'stop',
        },
      ],
    }));
    const events: ProviderEvent[] = [];
    for await (const e of new OpenAIProvider({ apiKey: 'k' }).chatStream(chatReq())) events.push(e);
    const stop = events.find((e) => e.kind === 'message_stop');
    if (stop?.kind === 'message_stop') {
      expect(stop.stopReason).toBe('tool_use'); // not end_turn → runTurn dispatches (no orphan)
      expect(stop.toolUses).toEqual([{ id: 'c1', name: 'f', input: {} }]);
    }
  });

  test('tool_choice:"required" is sent when tools are present', async () => {
    let body = '';
    setOpenAIFetcher(async (a) => {
      body = JSON.stringify(a.body);
      return { choices: [{ message: { content: 'x' }, finish_reason: 'stop' }] };
    });
    for await (const _ of new OpenAIProvider({ apiKey: 'k' }).chatStream(chatReq())) void _;
    expect(body).toContain('"tool_choice":"required"');
  });

  test('complete() sends reasoning_effort:low for a reasoning model', async () => {
    let body = '';
    setOpenAIFetcher(async (a) => {
      body = JSON.stringify(a.body);
      return { choices: [{ message: { content: 'sum' }, finish_reason: 'stop' }] };
    });
    const p = new OpenAIProvider({ apiKey: 'k', entry: { id: 'o3', protocol: 'openai', reasoning: true } });
    await p.complete({ system: 's', messages: [{ role: 'user', content: 'hi' }] });
    expect(body).toContain('"reasoning_effort":"low"');
  });

  test('chatUrl uses LUNA_OPENAI_BASE_URL and never falls back to the Anthropic host', async () => {
    const savedOpenAI = Bun.env['LUNA_OPENAI_BASE_URL'];
    const savedAnthropic = Bun.env['ANTHROPIC_BASE_URL'];
    try {
      Bun.env['ANTHROPIC_BASE_URL'] = 'https://api.anthropic.com';
      Bun.env['LUNA_OPENAI_BASE_URL'] = 'https://gw.example/v1';
      let url = '';
      setOpenAIFetcher(async (a) => {
        url = a.url;
        return { choices: [{ message: { content: 'x' }, finish_reason: 'stop' }] };
      });
      await new OpenAIProvider({ apiKey: 'k' }).complete({ system: 's', messages: [] });
      expect(url).toBe('https://gw.example/v1/chat/completions');

      delete Bun.env['LUNA_OPENAI_BASE_URL']; // unset → OpenAI's own default, NOT the Anthropic host
      let url2 = '';
      setOpenAIFetcher(async (a) => {
        url2 = a.url;
        return { choices: [{ message: { content: 'x' }, finish_reason: 'stop' }] };
      });
      await new OpenAIProvider({ apiKey: 'k' }).complete({ system: 's', messages: [] });
      expect(url2).toBe('https://api.openai.com/v1/chat/completions');
      expect(url2).not.toContain('anthropic');
    } finally {
      if (savedOpenAI === undefined) delete Bun.env['LUNA_OPENAI_BASE_URL'];
      else Bun.env['LUNA_OPENAI_BASE_URL'] = savedOpenAI;
      if (savedAnthropic === undefined) delete Bun.env['ANTHROPIC_BASE_URL'];
      else Bun.env['ANTHROPIC_BASE_URL'] = savedAnthropic;
    }
  });
});
