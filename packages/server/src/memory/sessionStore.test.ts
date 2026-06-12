import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import type Anthropic from '@anthropic-ai/sdk';
import { MockProvider } from '../provider/mock';
import type { ProviderEvent } from '../provider/types';
import { builtinRegistry } from '../tools/registry';
import { getSession, resetSessions } from '../turn/session';
import { runTurn } from '../turn/runTurn';
import { migrate } from '../sql';
import { appendL2, listL2, loadSession, persistSession, setMemoryDb } from './sessionStore';

let db: Database;

function freshDb(): Database {
  const d = new Database(':memory:', { strict: true });
  migrate(d, join(import.meta.dir, '..', 'migrations'));
  return d;
}

beforeEach(() => {
  db = freshDb();
  setMemoryDb(db);
  resetSessions();
});

afterEach(() => {
  setMemoryDb(null);
  db.close(false);
  resetSessions();
});

function toolTurnRounds(): ProviderEvent[][] {
  const toolContent = [
    { type: 'thinking', thinking: 'let me check', signature: 'sig-abc' },
    { type: 'tool_use', id: 'tu1', name: 'time_now', input: {} },
  ] as unknown as Anthropic.ContentBlock[];
  const textContent = [{ type: 'text', text: 'noon' }] as unknown as Anthropic.ContentBlock[];
  return [
    [
      { kind: 'text_delta', text: 'check ' },
      {
        kind: 'message_stop',
        stopReason: 'tool_use',
        toolUses: [{ id: 'tu1', name: 'time_now', input: {} }],
        assistantContent: toolContent,
        usage: { input_tokens: 10, output_tokens: 5 },
      },
    ],
    [
      { kind: 'text_delta', text: 'noon' },
      {
        kind: 'message_stop',
        stopReason: 'end_turn',
        toolUses: [],
        assistantContent: textContent,
        usage: { input_tokens: 10, output_tokens: 2 },
      },
    ],
  ];
}

describe('sessionStore', () => {
  test('restart survives history including signed thinking + tool_use blocks', async () => {
    const session = getSession('default');
    await runTurn({
      session,
      turnId: 't1',
      userText: 'what time',
      provider: new MockProvider(toolTurnRounds()),
      registry: builtinRegistry,
      emit: () => {},
    });

    const historyBefore = JSON.stringify(session.history);
    const turnSeqBefore = session.turnSeq;
    expect(session.history.length).toBe(4);

    resetSessions();
    const rehydrated = getSession('default');
    expect(JSON.stringify(rehydrated.history)).toBe(historyBefore);
    expect(rehydrated.turnSeq).toBe(turnSeqBefore);

    const assistantMsg = rehydrated.history[1];
    const blocks = assistantMsg?.content as Anthropic.ContentBlock[];
    expect(blocks[0]?.type).toBe('thinking');
    expect((blocks[0] as { signature: string }).signature).toBe('sig-abc');
  });

  test('L2 rows appended in order with full text + raw_json fidelity', async () => {
    const session = getSession('default');
    for (let i = 0; i < 3; i++) {
      const text = [{ type: 'text', text: `reply ${i}` }] as unknown as Anthropic.ContentBlock[];
      await runTurn({
        session,
        turnId: `t${i}`,
        userText: `msg ${i}`,
        provider: new MockProvider([
          [
            { kind: 'text_delta', text: `reply ${i}` },
            {
              kind: 'message_stop',
              stopReason: 'end_turn',
              toolUses: [],
              assistantContent: text,
              usage: { input_tokens: 1, output_tokens: 1 },
            },
          ],
        ]),
        registry: builtinRegistry,
        emit: () => {},
      });
    }

    const rows = listL2('default');
    expect(rows.length).toBe(3);
    expect(rows.map((r) => r.user_text)).toEqual(['msg 0', 'msg 1', 'msg 2']);
    expect(rows[1]?.assistant_text).toBe('reply 1');
    const raw = JSON.parse(rows[0]!.raw_json) as Anthropic.MessageParam[];
    expect(raw.length).toBe(2);
    expect(raw[0]?.role).toBe('user');
    expect(raw[1]?.role).toBe('assistant');
  });

  test('unset seam = fully ephemeral (no throws, no persistence)', async () => {
    setMemoryDb(null);
    const session = getSession('eph');
    persistSession('eph', session.history, 0);
    appendL2({ sessionId: 'eph', turnId: 't', userText: 'u', assistantText: 'a', rawContent: [] });
    expect(loadSession('eph')).toBeNull();
    expect(listL2('eph')).toEqual([]);
  });

  test('persistSession upserts (second write replaces, not duplicates)', () => {
    persistSession('s1', [{ role: 'user', content: 'a' }], 1);
    persistSession('s1', [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }], 2);
    const loaded = loadSession('s1');
    expect(loaded?.turnSeq).toBe(2);
    expect(loaded?.history.length).toBe(2);
    const count = db.prepare('SELECT COUNT(*) c FROM sessions').get() as { c: number };
    expect(count.c).toBe(1);
  });
});
