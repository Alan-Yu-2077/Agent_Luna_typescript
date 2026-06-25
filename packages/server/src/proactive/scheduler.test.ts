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
import { resetDreamStateForTests } from '../dream/dreamState';
import { TraceStore } from '../trace/store';
import { setTraceStore } from '../trace/instrument';
import { loadCadence } from './cadence';
import { runTick, setProactiveDetectorForTests, type SchedulerDeps } from './scheduler';

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
  // Disable quiet-hours so the tick is clock-independent (the default 0–5 would
  // short-circuit on a UTC CI runner landing at 00:00–05:59).
  Bun.env['LUNA_PROACTIVE_QUIET_HOURS'] = '';
  resetSessions();
  resetDreamStateForTests(); // clear any fire-and-forget dream leaked from a prior test
});
afterEach(() => {
  setMemoryDb(null);
  setTraceStore(null);
  delete Bun.env['LUNA_PROACTIVE'];
  delete Bun.env['LUNA_PROACTIVE_QUIET_HOURS'];
  delete Bun.env['LUNA_PROACTIVE_LLM_GATE'];
  delete Bun.env['LUNA_TRACE'];
  setProactiveDetectorForTests(null); // restore the real detector
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

function allWakeDecisions(): { decision: string; reason: string }[] {
  return (
    db
      .prepare("SELECT payload_json FROM traces WHERE kind='decision' AND payload_json LIKE '%proactive_wake%'")
      .all() as { payload_json: string }[]
  ).map((r) => JSON.parse(r.payload_json));
}

// ─── the deterministic detector path (v0.22.0 default) ──────────────────────────
describe('proactive scheduler — detector path (default)', () => {
  // force the after-a-night detector on/off so the tick is clock-independent
  const triggerOn = () => setProactiveDetectorForTests(() => ({ seed: 'after-a-night context' }));
  const triggerOff = () => setProactiveDetectorForTests(() => null);

  test('disabled (LUNA_PROACTIVE=0) → no-op even if a detector would fire', async () => {
    Bun.env['LUNA_PROACTIVE'] = '0';
    triggerOn();
    const { deps, gate, turnProvider } = makeDeps('', [[endRound]]);
    await runTick(deps);
    expect(gate.completeRequests.length).toBe(0);
    expect(turnProvider.requests.length).toBe(0);
  });

  test('no detector fires → no turn, and NO LLM gate call (zero idle polling)', async () => {
    triggerOff();
    const { deps, gate, turnProvider } = makeDeps('', [[endRound]]);
    await runTick(deps);
    expect(gate.completeRequests.length).toBe(0); // the whole point: no per-tick LLM
    expect(turnProvider.requests.length).toBe(0);
  });

  test('a trigger + a SILENT turn fires, no gate call, stamps cooldown, quota stays 0', async () => {
    triggerOn();
    getSession('default'); // register the session so the scheduler considers it
    const { deps, gate, turnProvider, events } = makeDeps('', [[endRound]]); // silent
    await runTick(deps);
    expect(gate.completeRequests.length).toBe(0); // detector path never calls the LLM gate
    expect(turnProvider.requests.length).toBeGreaterThanOrEqual(1);
    expect(events.some((e) => e.type === 'proactive.started')).toBe(true);
    const c = loadCadence('default');
    expect(c.quotaUsed).toBe(0); // SILENT draft does not burn the daily message budget
    expect(c.lastProactiveMs).toBeGreaterThan(0); // ...but the cooldown anchor is stamped
  });

  test('a > 18h deep-absence gap still fires (NOT swallowed by deep_absence)', async () => {
    triggerOn();
    getSession('default').lastUserMs = Date.now() - 20 * 60 * 60_000; // 20h ago
    const { deps, turnProvider } = makeDeps('', [[endRound]]);
    await runTick(deps);
    expect(turnProvider.requests.length).toBeGreaterThanOrEqual(1); // the HIGH fix
  });

  test('cooldown blocks a second tick right after a fire', async () => {
    triggerOn();
    getSession('default');
    await runTick(makeDeps('', [[endRound]]).deps);
    expect(loadCadence('default').lastProactiveMs).toBeGreaterThan(0);
    const second = makeDeps('', [[endRound]]);
    await runTick(second.deps);
    expect(second.turnProvider.requests.length).toBe(0); // within the 5m cooldown
  });

  test('an active user turn is never overlapped', async () => {
    triggerOn();
    const s = getSession('default');
    s.activeTurn = 'busy-turn';
    const { deps, turnProvider } = makeDeps('', [[endRound]]);
    await runTick(deps);
    expect(turnProvider.requests.length).toBe(0);
    s.activeTurn = null;
  });

  test('concurrent ticks: the reentrancy guard prevents a second back-to-back fire', async () => {
    triggerOn();
    getSession('default');
    const a = makeDeps('', [[endRound]]);
    const b = makeDeps('', [[endRound]]);
    await Promise.all([runTick(a.deps), runTick(b.deps)]);
    expect(a.turnProvider.requests.length).toBeGreaterThanOrEqual(1);
    expect(b.turnProvider.requests.length).toBe(0); // B saw `ticking` and returned
    expect(loadCadence('default').lastProactiveMs).toBeGreaterThan(0);
  });

  test('dream auto-trigger: a proactive turn that calls enter_dream starts a dream', async () => {
    triggerOn();
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
      dreamLlm: { primary: new MockProvider([]), fallback: null },
      emit: () => {},
    };
    const session = getSession('default');
    await runTick(deps);
    expect(session.pendingDream).toBeNull(); // the scheduler consumed the intent
    expect(turnProvider.requests.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── the legacy LLM wake-gate, now a default-off fallback ────────────────────────
describe('proactive scheduler — LLM wake-gate fallback (LUNA_PROACTIVE_LLM_GATE=1)', () => {
  // registers the session + puts it past the idle threshold the prefilter requires,
  // and flips on the legacy LLM gate (every fallback test calls this first).
  function idleSession() {
    Bun.env['LUNA_PROACTIVE_LLM_GATE'] = '1';
    const s = getSession('default');
    s.lastUserMs = Date.now() - 20 * 60_000; // 20 min idle (within [10m,18h])
    return s;
  }

  test('idle + verdict hold → wake decision logged, no turn', async () => {
    idleSession();
    const { deps, gate, turnProvider } = makeDeps('{"act":false,"reason":"nothing to do"}', [[endRound]]);
    await runTick(deps);
    expect(gate.completeRequests.length).toBe(1);
    expect(turnProvider.requests.length).toBe(0);
    expect(allWakeDecisions().some((d) => d.decision === 'hold')).toBe(true);
  });

  test('idle + verdict act → proactive turn fires (gate called); a silent turn keeps quota 0', async () => {
    idleSession();
    const { deps, gate, turnProvider, events } = makeDeps(
      '{"act":true,"intent":"reflect","reason":"a quiet thought"}',
      [[endRound]], // silent proactive turn
    );
    await runTick(deps);
    expect(gate.completeRequests.length).toBe(1);
    expect(turnProvider.requests.length).toBeGreaterThanOrEqual(1);
    expect(events.some((e) => e.type === 'proactive.started')).toBe(true);
    expect(allWakeDecisions().some((d) => d.decision === 'act')).toBe(true);
    const c = loadCadence('default');
    expect(c.quotaUsed).toBe(0); // silent → no quota burn (spoke/silent split)
    expect(c.lastProactiveMs).toBeGreaterThan(0);
  });

  test('prefilter cooldown blocks the gate call after a fire', async () => {
    idleSession();
    await runTick(makeDeps('{"act":true,"reason":"x"}', [[endRound]]).deps);
    const second = makeDeps('{"act":true,"reason":"x"}', [[endRound]]);
    await runTick(second.deps);
    expect(second.gate.completeRequests.length).toBe(0); // shouldConsiderWake cooldown short-circuit
    expect(second.turnProvider.requests.length).toBe(0);
  });
});
