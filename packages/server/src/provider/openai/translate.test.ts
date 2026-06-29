import { describe, expect, test } from 'bun:test';
import type Anthropic from '@anthropic-ai/sdk';
import {
  consumeSSE,
  mapStopReason,
  mapUsage,
  messagesToOpenAI,
  parseOpenAIResponse,
  parseToolArguments,
  systemToOpenAI,
  toAssistantContent,
  toProviderToolUses,
  toolsToOpenAI,
} from './translate';

describe('systemToOpenAI', () => {
  test('string system → system message', () => {
    expect(systemToOpenAI('you are Luna')).toEqual({ role: 'system', content: 'you are Luna' });
  });
  test('text-block system joins .text and drops cache_control', () => {
    const sys: Anthropic.TextBlockParam[] = [
      { type: 'text', text: 'core', cache_control: { type: 'ephemeral' } },
    ];
    expect(systemToOpenAI(sys)).toEqual({ role: 'system', content: 'core' });
  });
});

describe('messagesToOpenAI (the round-trip crux)', () => {
  test('a tool-using multi-turn history maps to correctly-ordered OpenAI messages', () => {
    const history: Anthropic.MessageParam[] = [
      { role: 'user', content: [{ type: 'text', text: 'find the readme' }] },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'on it' },
          { type: 'tool_use', id: 'call_1', name: 'read_file', input: { path: 'README.md' } },
        ],
      },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'call_1', content: 'file body' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'it says hello' }] },
    ];
    expect(messagesToOpenAI(history)).toEqual([
      { role: 'user', content: 'find the readme' },
      {
        role: 'assistant',
        content: 'on it',
        tool_calls: [
          { id: 'call_1', type: 'function', function: { name: 'read_file', arguments: '{"path":"README.md"}' } },
        ],
      },
      { role: 'tool', tool_call_id: 'call_1', content: 'file body' },
      { role: 'assistant', content: 'it says hello' },
    ]);
  });

  test('a string-content message passes through by role', () => {
    expect(messagesToOpenAI([{ role: 'user', content: 'hi' }])).toEqual([{ role: 'user', content: 'hi' }]);
  });

  test('a user turn with BOTH tool_result and text → tool message THEN user message', () => {
    expect(
      messagesToOpenAI([
        {
          role: 'user',
          content: [
            { type: 'tool_result', tool_use_id: 'c1', content: 'r1' },
            { type: 'text', text: 'and also this' },
          ],
        },
      ]),
    ).toEqual([
      { role: 'tool', tool_call_id: 'c1', content: 'r1' },
      { role: 'user', content: 'and also this' },
    ]);
  });

  test('an assistant tool_use with no text → content null', () => {
    expect(
      messagesToOpenAI([
        { role: 'assistant', content: [{ type: 'tool_use', id: 'c1', name: 't', input: {} }] },
      ]),
    ).toEqual([
      { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 't', arguments: '{}' } }] },
    ]);
  });
});

describe('toolsToOpenAI', () => {
  test('Anthropic.Tool → function tool; parameters = input_schema', () => {
    const tools: Anthropic.Tool[] = [
      {
        name: 'read_file',
        description: 'read a file',
        input_schema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
      },
    ];
    expect(toolsToOpenAI(tools)).toEqual([
      {
        type: 'function',
        function: {
          name: 'read_file',
          description: 'read a file',
          parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
        },
      },
    ]);
  });
  test('missing description → empty string', () => {
    const tools: Anthropic.Tool[] = [{ name: 't', input_schema: { type: 'object', properties: {} } }];
    expect(toolsToOpenAI(tools)[0]?.function.description).toBe('');
  });
});

describe('parseToolArguments', () => {
  test('valid JSON object', () => {
    expect(parseToolArguments('{"a":1}')).toEqual({ a: 1 });
  });
  test('empty / whitespace → {} (no-arg tools)', () => {
    expect(parseToolArguments('')).toEqual({});
    expect(parseToolArguments('   ')).toEqual({});
  });
  test('malformed → {}', () => {
    expect(parseToolArguments('{not json')).toEqual({});
  });
  test('non-object JSON (array/number/string) → {}', () => {
    expect(parseToolArguments('[1,2]')).toEqual({});
    expect(parseToolArguments('42')).toEqual({});
    expect(parseToolArguments('"x"')).toEqual({});
  });
});

describe('response translation (OpenAI → Anthropic-shaped)', () => {
  test('text-only response → one text block, no tool uses', () => {
    const parsed = parseOpenAIResponse({
      choices: [{ message: { content: 'hello there' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 3 },
    });
    const msg = parsed.choices[0]?.message;
    expect(msg && toAssistantContent(msg)).toEqual([{ type: 'text', text: 'hello there' }]);
    expect(msg && toProviderToolUses(msg)).toEqual([]);
    expect(mapStopReason(parsed.choices[0]?.finish_reason)).toBe('end_turn');
    expect(mapUsage(parsed.usage)).toEqual({ input_tokens: 10, output_tokens: 3 });
  });

  test('tool-call response → tool_use block + provider tool uses (args parsed)', () => {
    const parsed = parseOpenAIResponse({
      choices: [
        {
          message: { content: null, tool_calls: [{ id: 'c1', function: { name: 'read_file', arguments: '{"path":"x"}' } }] },
          finish_reason: 'tool_calls',
        },
      ],
    });
    const msg = parsed.choices[0]?.message;
    expect(msg && toAssistantContent(msg)).toEqual([{ type: 'tool_use', id: 'c1', name: 'read_file', input: { path: 'x' } }]);
    expect(msg && toProviderToolUses(msg)).toEqual([{ id: 'c1', name: 'read_file', input: { path: 'x' } }]);
    expect(mapStopReason('tool_calls')).toBe('tool_use');
    expect(mapStopReason('length')).toBe('max_tokens');
  });

  test('text + tool_calls together → both blocks (text first)', () => {
    const parsed = parseOpenAIResponse({
      choices: [
        {
          message: { content: 'let me check', tool_calls: [{ id: 'c2', function: { name: 't', arguments: '' } }] },
          finish_reason: 'tool_calls',
        },
      ],
    });
    const msg = parsed.choices[0]?.message;
    expect(msg && toAssistantContent(msg)).toEqual([
      { type: 'text', text: 'let me check' },
      { type: 'tool_use', id: 'c2', name: 't', input: {} },
    ]);
  });

  test('usage absent → zeros', () => {
    const parsed = parseOpenAIResponse({ choices: [{ message: { content: 'x' }, finish_reason: 'stop' }] });
    expect(mapUsage(parsed.usage)).toEqual({ input_tokens: 0, output_tokens: 0 });
  });
});

describe('consumeSSE (the byte-framing parser)', () => {
  test('complete data lines → payloads, empty remainder', () => {
    const r = consumeSSE('data: {"a":1}\ndata: {"b":2}\n');
    expect(r.payloads).toEqual(['{"a":1}', '{"b":2}']);
    expect(r.rest).toBe('');
    expect(r.done).toBe(false);
  });
  test('a line split across reads is kept in the remainder', () => {
    const r = consumeSSE('data: {"a":1}\ndata: {"b"');
    expect(r.payloads).toEqual(['{"a":1}']);
    expect(r.rest).toBe('data: {"b"'); // re-fed with the next read
  });
  test('CRLF endings are tolerated', () => {
    expect(consumeSSE('data: {"a":1}\r\n').payloads).toEqual(['{"a":1}']);
  });
  test('[DONE] sets done and stops', () => {
    const r = consumeSSE('data: {"a":1}\ndata: [DONE]\ndata: {"ignored":1}\n');
    expect(r.payloads).toEqual(['{"a":1}']);
    expect(r.done).toBe(true);
  });
  test('non-data lines (comments/keepalives) are skipped', () => {
    expect(consumeSSE(': keepalive\n\ndata: {"a":1}\n').payloads).toEqual(['{"a":1}']);
  });
  test('a final line with a forced terminating newline is recovered (the end-of-stream flush)', () => {
    // the caller appends "\n" at stream end so a trailing payload without a newline is not lost
    expect(consumeSSE('data: {"last":true}\n').payloads).toEqual(['{"last":true}']);
  });
});
