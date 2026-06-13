import { beforeEach, describe, expect, test } from 'bun:test';
import type Anthropic from '@anthropic-ai/sdk';
import type { ServerEvent } from '@luna/protocol';
import { MockProvider } from '../provider/mock';
import type { ProviderEvent } from '../provider/types';
import { builtinRegistry, isMessageMode, messageRegistry } from '../tools/registry';
import { getSession, resetSessions } from './session';
import { runTurn } from './runTurn';

function stopWithMessages(calls: { id: string; input: unknown }[]): ProviderEvent {
  const toolUses = calls.map((c) => ({ id: c.id, name: 'message', input: c.input }));
  return {
    kind: 'message_stop',
    stopReason: 'tool_use',
    toolUses,
    assistantContent: toolUses.map((t) => ({
      type: 'tool_use',
      id: t.id,
      name: t.name,
      input: t.input,
    })) as unknown as Anthropic.ContentBlock[],
    usage: { input_tokens: 20, output_tokens: 10 },
  };
}

function stopEnd(text = ''): ProviderEvent {
  return {
    kind: 'message_stop',
    stopReason: 'end_turn',
    toolUses: [],
    assistantContent: (text
      ? [{ type: 'text', text }]
      : []) as unknown as Anthropic.ContentBlock[],
    usage: { input_tokens: 20, output_tokens: 5 },
  };
}

async function turn(provider: MockProvider, userText: string, registry = messageRegistry) {
  const session = getSession('msg-mode');
  const events: ServerEvent[] = [];
  await runTurn({
    session,
    turnId: `t${session.turnSeq + 1}`,
    userText,
    provider,
    registry,
    emit: (e) => events.push(e),
  });
  return events;
}

beforeEach(() => {
  resetSessions();
});

describe('message-tool mode (LUNA_MESSAGE_TOOL registry)', () => {
  test('isMessageMode derives from registry content', () => {
    expect(isMessageMode(messageRegistry)).toBe(true);
    expect(isMessageMode(builtinRegistry)).toBe(false);
  });

  test('system prompt carries the speech directive only in message mode', async () => {
    const p1 = new MockProvider([[stopEnd('hi')]]);
    await turn(p1, 'a', builtinRegistry);
    const p2 = new MockProvider([[stopEnd('')]]);
    resetSessions();
    await turn(p2, 'a', messageRegistry);
    const sysOff = JSON.stringify(p1.requests[0]?.system);
    const sysOn = JSON.stringify(p2.requests[0]?.system);
    expect(sysOff).not.toContain('calling it IS speaking');
    expect(sysOn).toContain('calling it IS speaking');
  });

  test('two message calls become bubbles; turn.result is their concatenation', async () => {
    const provider = new MockProvider([
      [
        stopWithMessages([
          { id: 'm1', input: { text: '想你了。', is_final: false } },
          { id: 'm2', input: { text: '今天过得怎么样？', is_final: true } },
        ]),
      ],
      [stopEnd('')],
    ]);
    const events = await turn(provider, '在吗');

    const finished = events.filter((e) => e.type === 'tool.finished');
    expect(finished.length).toBe(2);
    const first = finished[0] as { result: { kind: string; data: { segments: unknown[] } } };
    expect(first.result.kind).toBe('ok');
    expect(first.result.data.segments.length).toBe(1);

    const result = events.find((e) => e.type === 'turn.result') as { text: string };
    expect(result.text).toBe('想你了。\n今天过得怎么样？');
  });

  test('humanity violation → recoverable validation_failed; re-emit wins; no leak into turn text', async () => {
    const provider = new MockProvider([
      [stopWithMessages([{ id: 'm1', input: { text: '一。二。三。四。五。', is_final: true } }])],
      [stopWithMessages([{ id: 'm2', input: { text: '换短的说法。', is_final: true } }])],
      [stopEnd('stray top-level text')],
    ]);
    const events = await turn(provider, 'hi');

    const finished = events.filter((e) => e.type === 'tool.finished') as {
      result: { kind: string; code?: string; recoverable?: boolean };
    }[];
    expect(finished[0]!.result.kind).toBe('err');
    expect(finished[0]!.result.code).toBe('validation_failed');
    expect(finished[0]!.result.recoverable).toBe(true);
    expect(finished[1]!.result.kind).toBe('ok');

    const result = events.find((e) => e.type === 'turn.result') as { text: string };
    expect(result.text).toBe('换短的说法。');
  });

  test('flag-off path untouched: builtin registry yields plain text turn', async () => {
    const provider = new MockProvider([
      [{ kind: 'text_delta', text: '普通文本回复' }, stopEnd('普通文本回复')],
    ]);
    const events = await turn(provider, 'hello', builtinRegistry);
    const result = events.find((e) => e.type === 'turn.result') as { text: string };
    expect(result.text).toBe('普通文本回复');
  });
});
