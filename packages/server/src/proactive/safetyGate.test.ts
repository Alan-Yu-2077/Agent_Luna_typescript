import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import type Anthropic from '@anthropic-ai/sdk';
import type { ServerEvent } from '@luna/protocol';
import { MockProvider } from '../provider/mock';
import type { ProviderEvent } from '../provider/types';
import { defineTool, type Tool } from '../tools/defineTool';
import { messageRegistry, type ToolRegistry } from '../tools/registry';
import { getSession, resetSessions } from '../turn/session';
import { runTurn } from '../turn/runTurn';
import { TraceStore } from '../trace/store';
import { setTraceStore } from '../trace/instrument';
import { runProactiveTurn } from './proactiveTurn';
import { isProactiveActionAllowed, proactiveRiskOf } from './safetyGate';

// A synthetic SURFACE-risk tool (no `shell` exists yet). Reuses the 'time_now'
// ToolName slot but omits proactiveRisk → fail-closed to 'surface'.
let ran = false;
const surfaceTool = defineTool({
  name: 'time_now',
  description: 'synthetic surface-risk tool for the gate test',
  input: z.object({}),
  output: z.object({ ran: z.boolean() }),
  concurrency: 'safe-parallel',
  timeoutMs: 1000,
  summarize: () => 'ran',
  execute: async function* () {
    ran = true;
    yield { kind: 'ok', data: { ran: true } };
  },
});
const surfaceRegistry: ToolRegistry = { ...messageRegistry, time_now: surfaceTool };

function toolRound(id: string, name: string, input: unknown): ProviderEvent {
  return {
    kind: 'message_stop',
    stopReason: 'tool_use',
    toolUses: [{ id, name, input }],
    assistantContent: [{ type: 'tool_use', id, name, input }] as unknown as Anthropic.ContentBlock[],
    usage: { input_tokens: 10, output_tokens: 5 },
  };
}
function msgRound(id: string, text: string): ProviderEvent {
  const input = { text, is_final: false };
  return {
    kind: 'message_stop',
    stopReason: 'tool_use',
    toolUses: [{ id, name: 'message', input }],
    assistantContent: [
      { type: 'tool_use', id, name: 'message', input },
    ] as unknown as Anthropic.ContentBlock[],
    usage: { input_tokens: 10, output_tokens: 5 },
  };
}
const endRound: ProviderEvent = {
  kind: 'message_stop',
  stopReason: 'end_turn',
  toolUses: [],
  assistantContent: [] as unknown as Anthropic.ContentBlock[],
  usage: { input_tokens: 5, output_tokens: 1 },
};

let db: Database;
let store: TraceStore;

beforeEach(() => {
  db = new Database(':memory:', { strict: true });
  db.exec(readFileSync(join(import.meta.dir, '..', 'migrations', '0001_traces.sql'), 'utf8'));
  store = new TraceStore(db);
  setTraceStore(store);
  delete Bun.env['LUNA_TRACE'];
  resetSessions();
  ran = false;
});
afterEach(() => {
  setTraceStore(null);
  delete Bun.env['LUNA_TRACE'];
  delete Bun.env['LUNA_PROACTIVE_MAX_ACTIONS'];
  db.close(false);
});

describe('safety gate (pure)', () => {
  test('proactiveRiskOf fails closed for unmarked tools, safe only when opted in', () => {
    expect(proactiveRiskOf(undefined)).toBe('surface');
    expect(proactiveRiskOf(surfaceTool)).toBe('surface');
    expect(proactiveRiskOf(messageRegistry.recall as Tool)).toBe('safe');
  });
  test('isProactiveActionAllowed: safe always; surface only after surfacing', () => {
    expect(isProactiveActionAllowed('safe', false)).toBe(true);
    expect(isProactiveActionAllowed('surface', false)).toBe(false);
    expect(isProactiveActionAllowed('surface', true)).toBe(true);
  });
});

async function fireProactive(provider: MockProvider, registry = surfaceRegistry) {
  const events: ServerEvent[] = [];
  const result = await runProactiveTurn({
    session: getSession('default'),
    cycleId: 'c1',
    provider,
    registry,
    emit: (e) => events.push(e),
  });
  return { result, events };
}

function gateDecisions(): { decision: string; tool: string }[] {
  return store
    .getEventsByTurn('proactive:c1')
    .filter((e) => e.kind === 'decision')
    .map((e) => JSON.parse(e.payload_json))
    .filter((p) => p.surface === 'proactive_action')
    .map((p) => ({ decision: p.decision, tool: p.evidence?.tool }));
}

describe('hard gate (block → surface → execute)', () => {
  test('surface-risk action with no prior surfacing is BLOCKED, not executed', async () => {
    const provider = new MockProvider([
      [toolRound('s1', 'time_now', {})], // surface tool, nothing surfaced → blocked
      [endRound],
    ]);
    const { events } = await fireProactive(provider);
    expect(ran).toBe(false);
    const finished = events.find((e) => e.type === 'tool.finished') as {
      result: { kind: string; code?: string; recoverable?: boolean };
    };
    expect(finished.result.kind).toBe('err');
    expect(finished.result.recoverable).toBe(true);
    expect(gateDecisions().some((d) => d.decision === 'blocked' && d.tool === 'time_now')).toBe(true);
  });

  test('surface AFTER a message in a prior round is ALLOWED and executes', async () => {
    const provider = new MockProvider([
      [msgRound('m1', '我打算清理一下临时文件，先跟你说一声。')], // round 1: surface
      [toolRound('s1', 'time_now', {})], // round 2: now allowed
      [endRound],
    ]);
    await fireProactive(provider);
    expect(ran).toBe(true);
    expect(gateDecisions().some((d) => d.decision === 'blocked')).toBe(false);
  });

  test('safe tools run silently with no surfacing (gate does not touch them)', async () => {
    const provider = new MockProvider([
      [toolRound('r1', 'recall', { query: '咖啡' })], // safe → allowed silently
      [endRound],
    ]);
    await fireProactive(provider, messageRegistry); // recall is safe in the real registry
    expect(gateDecisions().length).toBe(0);
  });

  test('reactive turns are NOT gated (gate is proactive-only)', async () => {
    const provider = new MockProvider([
      [toolRound('s1', 'time_now', {})], // surface tool in a REACTIVE turn → runs
      [endRound],
    ]);
    await runTurn({
      session: getSession('default'),
      turnId: 'reactive-1',
      userText: 'hi',
      provider,
      registry: surfaceRegistry,
      emit: () => {},
    });
    expect(ran).toBe(true);
  });

  test('action budget caps a proactive cycle', async () => {
    Bun.env['LUNA_PROACTIVE_MAX_ACTIONS'] = '2';
    const provider = new MockProvider([
      [toolRound('a1', 'recall', { query: 'x' })],
      [toolRound('a2', 'recall', { query: 'y' })],
      [toolRound('a3', 'recall', { query: 'z' })], // would be a 3rd action — budget is 2
      [endRound],
    ]);
    await fireProactive(provider, messageRegistry);
    // after 2 actions the cycle finalizes; the 3rd round is never requested
    expect(provider.requests.length).toBe(2);
  });
});
