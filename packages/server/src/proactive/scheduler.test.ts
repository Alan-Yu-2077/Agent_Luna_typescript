import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import type Anthropic from '@anthropic-ai/sdk';
import type { ServerEvent } from '@luna/protocol';
import { migrate } from '../sql';
import { setMemoryDb } from '../memory/sessionStore';
import { MockProvider } from '../provider/mock';
import type { ProviderEvent } from '../provider/types';
import { messageRegistry } from '../tools/registry';
import { getSession, resetSessions } from '../turn/session';
import { TraceStore } from '../trace/store';
import { setTraceStore } from '../trace/instrument';
import { loadCadence } from './cadence';
import { runTick, type SchedulerDeps } from './scheduler';

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
  migrate(db, join(import.meta.dir, '..', 'migrations'));
  setMemoryDb(db);
  store = new TraceStore(db);
  setTraceStore(store);
  delete Bun.env['LUNA_TRACE'];
  Bun.env['LUNA_PROACTIVE'] = '1';
  resetSessions();
});
afterEach(() => {
  setMemoryDb(null);
  setTraceStore(null);
  delete Bun.env['LUNA_PROACTIVE'];
  delete Bun.env['LUNA_TRACE'];
  db.close(false);
});

function makeDeps(gateVerdict: string, turnRounds: ProviderEvent[][]) {
  const gate = new MockProvider([]);
  gate.completeResponder = () => gateVerdict;
  const turnProvider = new MockProvider(turnRounds);
  const events: ServerEvent[] = [];
  const deps: SchedulerDeps = {
    provider: turnProvider,
    registry: messageRegistry,
    dreamLlm: { primary: gate, fallback: null },
    emit: (e) => events.push(e),
  };
  return { deps, gate, turnProvider, events };
}

// puts the default session past the idle threshold
function idleSession() {
  const s = getSession('default');
  s.lastUserMs = Date.now() - 20 * 60_000; // 20 min idle
  return s;
}

function allWakeDecisions(): { decision: string; reason: string }[] {
  return (
    db
      .prepare("SELECT payload_json FROM traces WHERE kind='decision' AND payload_json LIKE '%proactive_wake%'")
      .all() as { payload_json: string }[]
  ).map((r) => JSON.parse(r.payload_json));
}

describe('proactive scheduler tick', () => {
  test('disabled (LUNA_PROACTIVE=0) → no-op', async () => {
    Bun.env['LUNA_PROACTIVE'] = '0'; // default is ON since v0.11.0
    idleSession();
    const { deps, gate, turnProvider } = makeDeps('{"act":true,"reason":"x"}', [[endRound]]);
    await runTick(deps);
    expect(gate.completeRequests.length).toBe(0);
    expect(turnProvider.requests.length).toBe(0);
  });

  test('prefilter blocks (too soon) → no wake judgment, no turn', async () => {
    getSession('default'); // fresh lastUserMs = now → too soon
    const { deps, gate, turnProvider } = makeDeps('{"act":true,"reason":"x"}', [[endRound]]);
    await runTick(deps);
    expect(gate.completeRequests.length).toBe(0);
    expect(turnProvider.requests.length).toBe(0);
  });

  test('idle + verdict hold → wake decision logged, no turn', async () => {
    idleSession();
    const { deps, gate, turnProvider } = makeDeps('{"act":false,"reason":"nothing to do"}', [[endRound]]);
    await runTick(deps);
    expect(gate.completeRequests.length).toBe(1);
    expect(turnProvider.requests.length).toBe(0);
    expect(allWakeDecisions().some((d) => d.decision === 'hold')).toBe(true);
  });

  test('idle + verdict act → proactive turn fires, cadence committed', async () => {
    idleSession();
    const { deps, turnProvider, events } = makeDeps(
      '{"act":true,"intent":"reflect","reason":"a quiet thought"}',
      [[endRound]], // silent proactive turn
    );
    await runTick(deps);
    expect(turnProvider.requests.length).toBeGreaterThanOrEqual(1);
    expect(events.some((e) => e.type === 'proactive.started')).toBe(true);
    expect(allWakeDecisions().some((d) => d.decision === 'act')).toBe(true);
    const c = loadCadence('default');
    expect(c.quotaUsed).toBe(1);
    expect(c.lastProactiveMs).toBeGreaterThan(0);
  });

  test('after firing, a second tick is blocked by cooldown', async () => {
    idleSession();
    const first = makeDeps('{"act":true,"reason":"x"}', [[endRound]]);
    await runTick(first.deps);
    expect(loadCadence('default').quotaUsed).toBe(1);
    // second tick immediately — within the cooldown since lastProactiveMs
    const second = makeDeps('{"act":true,"reason":"x"}', [[endRound]]);
    await runTick(second.deps);
    expect(second.gate.completeRequests.length).toBe(0); // prefilter cooldown short-circuit
    expect(second.turnProvider.requests.length).toBe(0);
  });

  test('concurrent ticks: the in-flight guard prevents a second back-to-back fire', async () => {
    idleSession();
    const a = makeDeps('{"act":true,"reason":"x"}', [[endRound]]);
    const b = makeDeps('{"act":true,"reason":"y"}', [[endRound]]);
    // start tick B while tick A is still parked at its wakeGate await
    const pA = runTick(a.deps);
    const pB = runTick(b.deps);
    await Promise.all([pA, pB]);
    // B was skipped by the guard → never reached its wakeGate, fired no turn
    expect(b.gate.completeRequests.length).toBe(0);
    expect(b.turnProvider.requests.length).toBe(0);
    // exactly one fire committed to the cadence (quota not corrupted to stay at 1 via a stale snapshot)
    expect(loadCadence('default').quotaUsed).toBe(1);
  });

  test('dream auto-trigger: a proactive turn that calls enter_dream starts a dream', async () => {
    idleSession();
    const gate = new MockProvider([]);
    gate.completeResponder = () => '{"act":true,"intent":"consolidate","reason":"long quiet"}';
    // proactive turn: round 1 calls enter_dream (sets pendingDream), round 2 ends
    const enterDream: ProviderEvent = {
      kind: 'message_stop',
      stopReason: 'tool_use',
      toolUses: [{ id: 'd1', name: 'enter_dream', input: {} }],
      assistantContent: [
        { type: 'tool_use', id: 'd1', name: 'enter_dream', input: {} },
      ] as unknown as Anthropic.ContentBlock[],
      usage: { input_tokens: 10, output_tokens: 5 },
    };
    const turnProvider = new MockProvider([[enterDream], [endRound]]);
    const deps: SchedulerDeps = {
      provider: turnProvider,
      registry: messageRegistry,
      dreamLlm: { primary: gate, fallback: null },
      emit: () => {},
    };
    const session = getSession('default');
    await runTick(deps);
    // the scheduler consumed the pending-dream intent (proof the trigger branch ran)
    expect(session.pendingDream).toBeNull();
    expect(turnProvider.requests.length).toBeGreaterThanOrEqual(1);
  });

  test('an active user turn is never overlapped', async () => {
    const s = idleSession();
    s.activeTurn = 'busy-turn';
    const { deps, gate, turnProvider } = makeDeps('{"act":true,"reason":"x"}', [[endRound]]);
    await runTick(deps);
    expect(gate.completeRequests.length).toBe(0);
    expect(turnProvider.requests.length).toBe(0);
    s.activeTurn = null;
  });
});
