import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import type Anthropic from '@anthropic-ai/sdk';
import { migrate } from '../sql';
import { setMemoryDb } from '../memory/sessionStore';
import { MockProvider } from '../provider/mock';
import type { ProviderEvent } from '../provider/types';
import { messageRegistry, webSearchTools } from '../tools/registry';
import { getSession, resetSessions } from '../turn/session';
import { runProactiveTurn, resetProactiveOpenersForTests } from './proactiveTurn';
import { wandersUsedToday } from './quietWork';

// v0.45.17 (Initiative 37) — the P2 group's proactive half: an intent to dream must not outlive
// its turn, a whitespace "message" must not buy a day's quota, and the wander budget must count
// the wakings it actually governs.

const ENV = ['LUNA_QUIET_WORK', 'LUNA_SELFCONT'];
const saved: Record<string, string | undefined> = {};

let db: Database;
beforeEach(() => {
  for (const k of ENV) saved[k] = Bun.env[k];
  db = new Database(':memory:', { strict: true });
  migrate(db, join(import.meta.dir, '..', 'migrations'));
  setMemoryDb(db);
  resetSessions();
  resetProactiveOpenersForTests();
});
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete Bun.env[k];
    else Bun.env[k] = saved[k];
  }
  setMemoryDb(null);
  db.close(false);
});

const endRound: ProviderEvent = {
  kind: 'message_stop',
  stopReason: 'end_turn',
  toolUses: [],
  assistantContent: [] as unknown as Anthropic.ContentBlock[],
  usage: { input_tokens: 5, output_tokens: 1 },
};

function toolRound(name: string, input: unknown, id = 't1'): ProviderEvent[] {
  const toolUses = [{ id, name, input }];
  return [
    {
      kind: 'message_stop',
      stopReason: 'tool_use',
      toolUses,
      assistantContent: toolUses.map((t) => ({
        type: 'tool_use',
        id: t.id,
        name: t.name,
        input: t.input,
      })) as unknown as Anthropic.ContentBlock[],
      usage: { input_tokens: 5, output_tokens: 2 },
    },
  ];
}

describe('pendingDream never outlives its turn (P2#3)', () => {
  test('a path that CAN start a dream is handed the intent', async () => {
    const session = getSession('default');
    const started: string[] = [];
    session.pendingDream = null;
    const provider = new MockProvider([[endRound]]);
    await runProactiveTurn({
      session,
      cycleId: 'c1',
      provider,
      registry: messageRegistry,
      emit: () => {},
      scenario: 'ambient',
      onPendingDream: (reason) => started.push(reason),
    });
    // nothing pending → the starter is not called
    expect(started).toEqual([]);

    session.pendingDream = 'long day';
    const provider2 = new MockProvider([[endRound]]);
    await runProactiveTurn({
      session,
      cycleId: 'c2',
      provider: provider2,
      registry: messageRegistry,
      emit: () => {},
      scenario: 'ambient',
      onPendingDream: (reason) => started.push(reason),
    });
    expect(started).toEqual(['long day']);
    expect(session.pendingDream).toBeNull();
  });

  test('a path that CANNOT (continuation / dev-fire) drops it instead of leaving it armed', async () => {
    const session = getSession('default');
    session.pendingDream = 'restless';
    const provider = new MockProvider([[endRound]]);
    await runProactiveTurn({
      session,
      cycleId: `${session.id}:cont:1`,
      provider,
      registry: messageRegistry,
      emit: () => {},
      intent: 'continuation',
    });
    // Before v0.45.17 this flag survived to ambush the NEXT reactive turn — possibly the next
    // afternoon, walking the night window around by time travel.
    expect(session.pendingDream).toBeNull();
  });
});

describe('spoke means the same thing everywhere (P2, blank messages)', () => {
  test('a whitespace-only message is not "speaking" — no quota spent, nothing recorded as spoke', async () => {
    const session = getSession('default');
    const provider = new MockProvider([toolRound('message', { text: '   ', is_final: true }), [endRound]]);
    const { spoke } = await runProactiveTurn({
      session,
      cycleId: 'c3',
      provider,
      registry: messageRegistry,
      emit: () => {},
      scenario: 'ambient',
    });
    expect(spoke).toBe(false);
    const row = db.prepare('SELECT kind FROM proactive_outcomes').get() as { kind: string };
    expect(row.kind).not.toBe('spoke');
  });

  test('a real message still counts', async () => {
    const session = getSession('default');
    const provider = new MockProvider([
      toolRound('message', { text: '在的。', is_final: true }),
      [endRound],
    ]);
    const { spoke } = await runProactiveTurn({
      session,
      cycleId: 'c4',
      provider,
      registry: messageRegistry,
      emit: () => {},
      scenario: 'ambient',
    });
    expect(spoke).toBe(true);
  });
});

describe('the wander budget counts the wakings it governs (P1, both directions)', () => {
  // web_search must be MOUNTED here: an unmounted tool resolves to fail-closed 'surface' and is
  // blocked before dispatch in a proactive turn, so it would never reach the ledger at all.
  const wanderRegistry = { ...messageRegistry, ...webSearchTools };
  test('a continuation wander does not spend the daily allowance', async () => {
    const session = getSession('default');
    const provider = new MockProvider([toolRound('web_search', { query: 'x' }), [endRound]]);
    await runProactiveTurn({
      session,
      cycleId: `${session.id}:cont:2`,
      provider,
      registry: wanderRegistry,
      emit: () => {},
      intent: 'continuation',
    });
    expect(wandersUsedToday()).toBe(0);
  });

  test('a dev force-fire does not spend it either', async () => {
    const session = getSession('default');
    const provider = new MockProvider([toolRound('web_search', { query: 'x' }), [endRound]]);
    await runProactiveTurn({
      session,
      cycleId: 'dev',
      provider,
      registry: wanderRegistry,
      emit: () => {},
      devFire: true,
    });
    expect(wandersUsedToday()).toBe(0);
  });

  test('a scheduled waking that wandered AND spoke still counts (the old under-count)', async () => {
    const session = getSession('default');
    const provider = new MockProvider([
      [
        {
          kind: 'message_stop',
          stopReason: 'tool_use',
          toolUses: [
            { id: 'w1', name: 'web_search', input: { query: 'x' } },
            { id: 'm1', name: 'message', input: { text: '我看到一个有意思的东西。', is_final: true } },
          ],
          assistantContent: [] as unknown as Anthropic.ContentBlock[],
          usage: { input_tokens: 5, output_tokens: 2 },
        },
      ],
      [endRound],
    ]);
    const { spoke } = await runProactiveTurn({
      session,
      cycleId: 'c5',
      provider,
      registry: wanderRegistry,
      emit: () => {},
      scenario: 'ambient',
    });
    expect(spoke).toBe(true);
    expect(wandersUsedToday()).toBe(1);
  });
});
