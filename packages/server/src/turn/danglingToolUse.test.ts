import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import type Anthropic from '@anthropic-ai/sdk';
import type { ServerEvent } from '@luna/protocol';
import { migrate } from '../sql';
import { listL2, setMemoryDb } from '../memory/sessionStore';
import { MockProvider } from '../provider/mock';
import type { ProviderEvent } from '../provider/types';
import { messageRegistry } from '../tools/registry';
import { getSession, resetSessions } from './session';
import { partitionToolUse, runTurn } from './runTurn';

// v0.45.15 (Initiative 37, A1) — the promoted P0 repro. Written by the audit as a FAILING
// demonstration (a max_tokens round carrying a complete tool_use poisoned durable history with
// an unpaired tool_use → every later turn 400s → no rollback, fold, trim or restart could reach
// it, only DB surgery). Inverted here as the regression pin: the same script must now leave a
// clean history and a clean next request.

let db: Database;
beforeEach(() => {
  db = new Database(':memory:', { strict: true });
  migrate(db, join(import.meta.dir, '..', 'migrations'));
  setMemoryDb(db);
  Bun.env['LUNA_TRACE'] = '0';
  resetSessions();
});
afterEach(() => {
  setMemoryDb(null);
  delete Bun.env['LUNA_TRACE'];
  db.close(false);
});

function messageRound(id: string, text: string, isFinal: boolean): ProviderEvent[] {
  const input = { text, is_final: isFinal };
  return [
    {
      kind: 'message_stop',
      stopReason: 'tool_use',
      toolUses: [{ id, name: 'message', input }],
      assistantContent: [
        { type: 'tool_use', id, name: 'message', input },
      ] as unknown as Anthropic.ContentBlock[],
      usage: { input_tokens: 1, output_tokens: 1 },
    },
  ];
}

// A round the model truncated (or refused) AFTER emitting a complete tool_use block.
function truncatedRound(
  id: string,
  name: string,
  stopReason: 'max_tokens' | 'refusal',
  extra: Anthropic.ContentBlock[] = [],
): ProviderEvent[] {
  const input = { query: 'x' };
  return [
    {
      kind: 'message_stop',
      stopReason,
      toolUses: [{ id, name, input }],
      assistantContent: [
        ...extra,
        { type: 'tool_use', id, name, input },
      ] as unknown as Anthropic.ContentBlock[],
      usage: { input_tokens: 1, output_tokens: 1 },
    },
  ];
}

function hasUnpairedToolUse(messages: unknown): boolean {
  const flat = JSON.stringify(messages);
  const uses = [...flat.matchAll(/"type":"tool_use","id":"([^"]+)"/g)].map((m) => m[1]);
  return uses.some((id) => !flat.includes(`"tool_use_id":"${id}"`));
}

describe('partitionToolUse (pure)', () => {
  test('splits tool_use from everything else, order preserved', () => {
    const content: Anthropic.ContentBlockParam[] = [
      { type: 'text', text: 'thinking out loud' },
      { type: 'tool_use', id: 'a', name: 'web_search', input: {} },
      { type: 'text', text: 'more' },
    ];
    const { kept, dropped } = partitionToolUse(content);
    expect(kept.map((b) => b.type)).toEqual(['text', 'text']);
    expect(dropped.map((b) => b.id)).toEqual(['a']);
  });

  test('no tool_use → nothing dropped', () => {
    const { kept, dropped } = partitionToolUse([{ type: 'text', text: 'hi' }]);
    expect(kept.length).toBe(1);
    expect(dropped).toEqual([]);
  });
});

describe('the P0: a truncated round must not poison history', () => {
  test('max_tokens after a complete tool_use → kept turn, clean history, clean next request', async () => {
    const session = getSession('a1');
    const provider = new MockProvider([
      messageRound('m1', 'let me check', false),
      truncatedRound('w1', 'web_search', 'max_tokens'),
    ]);
    await runTurn({
      session,
      turnId: 'a1t1',
      userText: 'hi',
      provider,
      registry: messageRegistry,
      emit: () => {},
    });

    // The turn is still KEPT — round 1 delivered a real message the user saw.
    expect(listL2('a1').length).toBe(1);
    // …but the undispatched call is gone from durable history.
    const flat = JSON.stringify(session.history);
    expect(flat).not.toContain('"w1"');
    expect(hasUnpairedToolUse(session.history)).toBe(false);

    // And the NEXT turn's request — the thing the real API 400'd on — is clean.
    const provider2 = new MockProvider([messageRound('m9', 'ok', true)]);
    await runTurn({
      session,
      turnId: 'a1t2',
      userText: 'next',
      provider: provider2,
      registry: messageRegistry,
      emit: () => {},
    });
    expect(hasUnpairedToolUse(provider2.requests[0]?.messages)).toBe(false);
    expect(JSON.stringify(provider2.requests[0]?.messages)).not.toContain('w1');
  });

  test('refusal after a complete tool_use → same cleanliness', async () => {
    const session = getSession('a2');
    const provider = new MockProvider([
      messageRound('m1', 'sure', true),
      truncatedRound('w2', 'web_search', 'refusal'),
    ]);
    await runTurn({
      session,
      turnId: 'a2t1',
      userText: 'hi',
      provider,
      registry: messageRegistry,
      emit: () => {},
    });
    expect(JSON.stringify(session.history)).not.toContain('"w2"');
    expect(hasUnpairedToolUse(session.history)).toBe(false);
  });

  test('text that survived the truncation is KEPT — only the unrunnable call is dropped', async () => {
    const session = getSession('a3');
    const provider = new MockProvider([
      messageRound('m1', 'here goes', false),
      truncatedRound('w3', 'web_search', 'max_tokens', [
        { type: 'text', text: 'partial thought' } as unknown as Anthropic.ContentBlock,
      ]),
    ]);
    await runTurn({
      session,
      turnId: 'a3t1',
      userText: 'hi',
      provider,
      registry: messageRegistry,
      emit: () => {},
    });
    const flat = JSON.stringify(session.history);
    expect(flat).toContain('partial thought');
    expect(flat).not.toContain('"w3"');
  });

  test('the dropped call is closed on the wire so the client discards its half-streamed bubble', async () => {
    const session = getSession('a4');
    const events: ServerEvent[] = [];
    const provider = new MockProvider([
      messageRound('m1', 'first', false),
      truncatedRound('m2', 'message', 'max_tokens'),
    ]);
    await runTurn({
      session,
      turnId: 'a4t1',
      userText: 'hi',
      provider,
      registry: messageRegistry,
      emit: (e) => events.push(e),
    });
    const closed = events.find(
      (e): e is Extract<ServerEvent, { type: 'tool.finished' }> =>
        e.type === 'tool.finished' && e.call_id === 'm2',
    );
    expect(closed).toBeDefined();
    expect(closed?.result.kind).toBe('err');
  });

  test('the secondary form: a single truncated round evaporates cleanly (no poison, no half turn)', async () => {
    const session = getSession('a5');
    const provider = new MockProvider([truncatedRound('m1', 'message', 'max_tokens')]);
    await runTurn({
      session,
      turnId: 'a5t1',
      userText: 'hi',
      provider,
      registry: messageRegistry,
      emit: () => {},
    });
    // Nothing was ever delivered, so the turn is not durable — and the rollback finds no
    // orphan to leave behind: history is back to exactly where it started.
    expect(listL2('a5').length).toBe(0);
    expect(session.history.length).toBe(0);
  });
});
