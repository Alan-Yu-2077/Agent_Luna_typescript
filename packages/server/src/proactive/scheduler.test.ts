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
import { resetProactiveFireStateForTests } from './fire';
import { fireProactiveForActiveSessions, runTick, type SchedulerDeps } from './scheduler';

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
  resetProactiveFireStateForTests(); // clear the in-flight lock + per-key debounce between tests
});
afterEach(() => {
  setMemoryDb(null);
  setTraceStore(null);
  delete Bun.env['LUNA_PROACTIVE'];
  delete Bun.env['LUNA_PROACTIVE_QUIET_HOURS'];
  delete Bun.env['LUNA_TRACE'];
  db.close(false);
});

// `gate` is the dream-LLM primary; since v0.22.3 deleted the wake-gate it is never called on
// the heartbeat — several tests assert exactly that (gate.completeRequests.length === 0).
function makeDeps(_unused: string, turnRounds: ProviderEvent[][]) {
  const gate = new MockProvider([]);
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

// ─── the silence-ladder path (the only path since v0.24.1) ───────────────
describe('proactive scheduler — ladder path (default)', () => {
  // a 15m silence → past the idle floor AND the 10m ladder threshold → a deterministic idle_nudge
  const idle = () => {
    const t = Date.now() - 15 * 60_000;
    const s = getSession('default');
    s.lastUserMs = t;
    s.lastActivityMs = t; // v0.29.0: the silence gap reads the activity anchor
  };

  test('disabled (LUNA_PROACTIVE=0) → no-op even on a long idle', async () => {
    Bun.env['LUNA_PROACTIVE'] = '0';
    idle();
    const { deps, gate, turnProvider } = makeDeps('', [[endRound]]);
    await runTick(deps);
    expect(gate.completeRequests.length).toBe(0);
    expect(turnProvider.requests.length).toBe(0);
  });

  test('a short silence → no turn, and NO LLM gate call (zero idle polling)', async () => {
    {
      const s = getSession('default');
      s.lastActivityMs = s.lastUserMs = Date.now() - 90_000; // 90s → no ladder scenario
    }
    const { deps, gate, turnProvider } = makeDeps('', [[endRound]]);
    await runTick(deps);
    expect(gate.completeRequests.length).toBe(0); // the whole point: no per-tick LLM
    expect(turnProvider.requests.length).toBe(0);
  });

  test('an idle silence + a SILENT turn fires, no gate call, stamps cooldown, quota stays 0', async () => {
    idle();
    const { deps, gate, turnProvider, events } = makeDeps('', [[endRound]]); // silent
    await runTick(deps);
    expect(gate.completeRequests.length).toBe(0); // the ladder never calls an LLM gate
    expect(turnProvider.requests.length).toBeGreaterThanOrEqual(1);
    expect(events.some((e) => e.type === 'proactive.started')).toBe(true);
    const c = loadCadence('default');
    expect(c.quotaUsed).toBe(0); // SILENT draft does not burn the daily message budget
    expect(c.lastProactiveMs).toBeGreaterThan(0); // ...but the cooldown anchor is stamped
  });

  test('a >18h absence → sleeping, no proactive (she waits for the user — pure-Python parity)', async () => {
    {
      const s = getSession('default');
      s.lastActivityMs = s.lastUserMs = Date.now() - 20 * 60 * 60_000; // 20h ago
    }
    const { deps, turnProvider } = makeDeps('', [[endRound]]);
    await runTick(deps);
    expect(turnProvider.requests.length).toBe(0); // long-absence → sleeping, not a nudge
    expect(loadCadence('default').phase).toBe('sleeping');
  });

  test('cooldown blocks a second tick right after a fire', async () => {
    idle();
    await runTick(makeDeps('', [[endRound]]).deps);
    expect(loadCadence('default').lastProactiveMs).toBeGreaterThan(0);
    const second = makeDeps('', [[endRound]]);
    await runTick(second.deps);
    expect(second.turnProvider.requests.length).toBe(0); // within the 5m cooldown
  });

  test('an active user turn is never overlapped', async () => {
    const s = getSession('default');
    s.activeTurn = 'busy-turn';
    idle();
    const { deps, turnProvider } = makeDeps('', [[endRound]]);
    await runTick(deps);
    expect(turnProvider.requests.length).toBe(0);
    s.activeTurn = null;
  });

  test('concurrent ticks: the reentrancy guard prevents a second back-to-back fire', async () => {
    idle();
    const a = makeDeps('', [[endRound]]);
    const b = makeDeps('', [[endRound]]);
    await Promise.all([runTick(a.deps), runTick(b.deps)]);
    expect(a.turnProvider.requests.length + b.turnProvider.requests.length).toBe(1); // exactly one
    expect(loadCadence('default').lastProactiveMs).toBeGreaterThan(0);
  });

  test('dream auto-trigger: a proactive turn that calls enter_dream starts a dream', async () => {
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
    idle();
    const session = getSession('default');
    await runTick(deps);
    expect(session.pendingDream).toBeNull(); // the scheduler consumed the intent
    expect(turnProvider.requests.length).toBeGreaterThanOrEqual(1);
  });

  // v0.22.2: the weather event hook reuses the SAME funnel + lock as the heartbeat.
  test('fireProactiveForActiveSessions runs the funnel for active sessions', async () => {
    idle();
    const { deps, turnProvider } = makeDeps('', [[endRound]]);
    await fireProactiveForActiveSessions(deps);
    expect(turnProvider.requests.length).toBeGreaterThanOrEqual(1);
    expect(loadCadence('default').lastProactiveMs).toBeGreaterThan(0);
  });

  test('the hook is a no-op while a user turn is active (shared single-turn lock)', async () => {
    const s = getSession('default');
    s.activeTurn = 'busy-turn';
    idle();
    const { deps, turnProvider } = makeDeps('', [[endRound]]);
    await fireProactiveForActiveSessions(deps);
    expect(turnProvider.requests.length).toBe(0);
    s.activeTurn = null;
  });
});
