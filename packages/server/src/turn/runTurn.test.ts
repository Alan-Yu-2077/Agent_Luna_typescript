import { beforeEach, describe, expect, test } from 'bun:test';
import { z } from 'zod';
import type { ServerEvent } from '@luna/protocol';
import type Anthropic from '@anthropic-ai/sdk';
import { MockProvider } from '../provider/mock';
import type { ProviderEvent } from '../provider/types';
import { defineTool } from '../tools/defineTool';
import { builtinRegistry, type ToolRegistry } from '../tools/registry';
import { getSession, resetSessions } from './session';
import { runTurn, toolsToAnthropicFormat, MAX_TOOL_ITERATIONS } from './runTurn';

function stopWithTool(
  id: string,
  name: string,
  input: unknown,
  outputTokens = 10,
): ProviderEvent {
  const assistantContent = [
    { type: 'tool_use', id, name, input },
  ] as unknown as Anthropic.ContentBlock[];
  return {
    kind: 'message_stop',
    stopReason: 'tool_use',
    toolUses: [{ id, name, input }],
    assistantContent,
    usage: { input_tokens: 20, output_tokens: outputTokens },
  };
}

function stopEnd(text: string): ProviderEvent {
  const assistantContent = [{ type: 'text', text }] as unknown as Anthropic.ContentBlock[];
  return {
    kind: 'message_stop',
    stopReason: 'end_turn',
    toolUses: [],
    assistantContent,
    usage: { input_tokens: 20, output_tokens: 5 },
  };
}

function progressRegistry(progressCount: number): ToolRegistry {
  const tool = defineTool({
    name: 'time_now',
    description: 'progress test tool',
    input: z.object({}),
    output: z.object({ ok: z.literal(true) }),
    concurrency: 'safe-parallel',
    timeoutMs: 1000,
    summarize: () => 'done',
    execute: async function* () {
      for (let i = 0; i < progressCount; i++) {
        await Bun.sleep(2);
        yield { kind: 'progress', payload: { step: i } };
      }
      yield { kind: 'ok', data: { ok: true as const } };
    },
  });
  return { time_now: tool, read_file: tool, remember: tool, enter_dream: tool };
}

async function run(
  rounds: ProviderEvent[][],
  registry: ToolRegistry = builtinRegistry,
  emitOverride?: (e: ServerEvent) => void,
) {
  const events: ServerEvent[] = [];
  const provider = new MockProvider(rounds);
  const session = getSession('test');
  const state = await runTurn({
    session,
    turnId: 't1',
    userText: 'hello',
    provider,
    registry,
    emit:
      emitOverride ??
      ((e) => {
        events.push(e);
      }),
  });
  return { events, provider, session, state };
}

describe('runTurn', () => {
  beforeEach(() => {
    resetSessions();
  });

  test('1. happy path event ordering with one tool round', async () => {
    const rounds: ProviderEvent[][] = [
      [
        { kind: 'text_delta', text: 'Let me check. ' },
        stopWithTool('tu1', 'time_now', {}),
      ],
      [{ kind: 'text_delta', text: 'It is noon.' }, stopEnd('It is noon.')],
    ];
    const { events, state } = await run(rounds);

    const types = events.map((e) => e.type);
    expect(types[0]).toBe('turn.started');
    expect(types).toContain('reply.token');
    expect(types).toContain('tool.started');
    expect(types).toContain('tool.finished');
    expect(types.at(-1)).toBe('turn.result');

    const startedIdx = types.indexOf('tool.started');
    const lastTokenIdx = types.lastIndexOf('reply.token');
    expect(lastTokenIdx).toBeGreaterThan(startedIdx);

    const result = events.at(-1);
    if (result?.type === 'turn.result') {
      expect(result.text).toBe('Let me check. It is noon.');
      expect(result.finish_reason).toBe('end_turn');
      expect(result.usage.input_tokens).toBe(40);
    }
    expect(state.session.history.length).toBe(4);
  });

  test('2. interleaving: reply.token before AND after tool.progress', async () => {
    const rounds: ProviderEvent[][] = [
      [{ kind: 'text_delta', text: 'Working. ' }, stopWithTool('tu1', 'time_now', {})],
      [{ kind: 'text_delta', text: 'Done.' }, stopEnd('Done.')],
    ];
    const { events } = await run(rounds, progressRegistry(3));

    const types = events.map((e) => e.type);
    const firstProgress = types.indexOf('tool.progress');
    const lastProgress = types.lastIndexOf('tool.progress');
    expect(firstProgress).toBeGreaterThan(-1);
    expect(types.slice(0, firstProgress)).toContain('reply.token');
    expect(types.slice(lastProgress + 1)).toContain('reply.token');
    expect(types.filter((t) => t === 'tool.progress').length).toBe(3);
  });

  test('3. tool input validation failure feeds structured err back to model', async () => {
    const rounds: ProviderEvent[][] = [
      [stopWithTool('tu1', 'read_file', { not_a_path: 1 })],
      [{ kind: 'text_delta', text: 'Sorry, bad path.' }, stopEnd('Sorry, bad path.')],
    ];
    const { events, provider } = await run(rounds);

    const round2 = provider.requests[1];
    expect(round2).toBeDefined();
    const lastMsg = round2?.messages.at(-1);
    expect(lastMsg?.role).toBe('user');
    const blocks = lastMsg?.content as Anthropic.ToolResultBlockParam[];
    expect(blocks[0]?.type).toBe('tool_result');
    expect(blocks[0]?.is_error).toBe(true);
    expect(String(blocks[0]?.content)).toContain('validation_failed');
    expect(String(blocks[0]?.content)).not.toMatch(/^Error/);

    const result = events.at(-1);
    if (result?.type === 'turn.result') {
      expect(result.finish_reason).toBe('end_turn');
    }
  });

  test('4. iteration cap terminates with max_iterations', async () => {
    const rounds: ProviderEvent[][] = [];
    for (let i = 0; i < MAX_TOOL_ITERATIONS + 2; i++) {
      rounds.push([stopWithTool(`tu${i}`, 'time_now', {})]);
    }
    const { events, provider } = await run(rounds);

    const result = events.at(-1);
    expect(result?.type).toBe('turn.result');
    if (result?.type === 'turn.result') {
      expect(result.finish_reason).toBe('max_iterations');
    }
    expect(provider.requests.length).toBe(MAX_TOOL_ITERATIONS);
  });

  test('5. dead-socket emit (ws-wrapped) does not break the turn; history intact', async () => {
    const rounds: ProviderEvent[][] = [
      [{ kind: 'text_delta', text: 'Check. ' }, stopWithTool('tu1', 'time_now', {})],
      [{ kind: 'text_delta', text: 'Noon.' }, stopEnd('Noon.')],
    ];
    let throwCount = 0;
    const deadSocketEmit = (e: ServerEvent) => {
      try {
        throwCount += 1;
        throw new Error('socket closed');
      } catch {
        /* the ws.ts wrapper swallows send failures exactly like this */
      }
      void e;
    };
    const { session, state } = await run(rounds, builtinRegistry, deadSocketEmit);

    expect(throwCount).toBeGreaterThan(0);
    expect(state.finishReason).toBe('end_turn');
    expect(session.history.length).toBe(4);
    expect(session.activeTurn).toBe(null);
  });

  test('6. provider mid-stream throw → error event, no silent re-run', async () => {
    const rounds: ProviderEvent[][] = [
      [
        { kind: 'text_delta', text: 'Hmm ' },
        { kind: 'thinking_delta', text: '__THROW__' },
      ],
      [stopEnd('should never be requested')],
    ];
    const { events, provider, session } = await run(rounds);

    const err = events.find((e) => e.type === 'error');
    expect(err).toBeDefined();
    if (err?.type === 'error') {
      expect(err.code).toBe('turn_failure');
    }
    expect(provider.requests.length).toBe(1);
    expect(session.activeTurn).toBe(null);
    expect(events.find((e) => e.type === 'turn.result')).toBeUndefined();
  });
});

describe('tool wire schemas (gateway compatibility)', () => {
  // The yunwu gateway mangles tools whose root schema is anyOf/oneOf (no
  // top-level properties): args come back wrapped as {"_noargs": "<raw>"}.
  // Every tool must therefore present a flat root-level object on the wire.
  test('every builtin tool schema is a root-level object with properties', () => {
    for (const t of toolsToAnthropicFormat(builtinRegistry)) {
      const s = t.input_schema as Record<string, unknown>;
      expect(s['type']).toBe('object');
      expect('properties' in s).toBe(true);
      expect('anyOf' in s).toBe(false);
      expect('oneOf' in s).toBe(false);
      expect('allOf' in s).toBe(false);
    }
  });
});
