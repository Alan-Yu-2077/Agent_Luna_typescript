import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import type Anthropic from '@anthropic-ai/sdk';
import type { ServerEvent } from '@luna/protocol';
import { migrate } from '../sql';
import { listL2, setMemoryDb } from '../memory/sessionStore';
import { MockProvider } from '../provider/mock';
import { builtinRegistry, messageRegistry } from '../tools/registry';
import { getSession, resetSessions } from './session';
import { runTurn } from './runTurn';
import { TraceStore } from '../trace/store';
import { setTraceStore } from '../trace/instrument';

// Regression for the audit's Bug A: a SQLite throw during persistence in the
// finally block must NOT reject runTurn (the ws call sites don't await it) and
// must NOT skip the trace flush.
describe('runTurn persistence resilience', () => {
  let db: Database;
  let store: TraceStore;

  beforeEach(() => {
    db = new Database(':memory:', { strict: true });
    migrate(db, join(import.meta.dir, '..', 'migrations'));
    store = new TraceStore(db);
    setMemoryDb(db);
    setTraceStore(store);
    delete Bun.env['LUNA_TRACE'];
    resetSessions();
  });
  afterEach(() => {
    setMemoryDb(null);
    setTraceStore(null);
    delete Bun.env['LUNA_TRACE'];
    db.close(false);
  });

  test('a persistence failure is caught, surfaced, and never skips trace flush', async () => {
    const session = getSession('r1'); // load while the tables exist
    // Sabotage persistSession's target (not l2_turns, whose loss would also break
    // the upstream retrieve() and stop the turn from ever producing a reply). The
    // turn delivers 'hi', appendL2 succeeds, persistSession throws in the finally.
    db.exec('DROP TABLE sessions'); // now persistSession will throw (no such table)

    const events: ServerEvent[] = [];
    const provider = new MockProvider([
      [
        { kind: 'text_delta', text: 'hi' },
        {
          kind: 'message_stop',
          stopReason: 'end_turn',
          toolUses: [],
          assistantContent: [{ type: 'text', text: 'hi' }] as unknown as Anthropic.ContentBlock[],
          usage: { input_tokens: 1, output_tokens: 1 },
        },
      ],
    ]);

    // must resolve, not reject
    await expect(
      runTurn({ session, turnId: 'rt1', userText: 'x', provider, registry: builtinRegistry, emit: (e) => events.push(e) }),
    ).resolves.toBeDefined();

    // surfaced as a structured error
    expect(events.some((e) => e.type === 'error' && e.code === 'persistence_failed')).toBe(true);
    // and the trace flush still ran despite the persistence throw
    expect(store.getEventsByTurn('rt1').length).toBeGreaterThan(0);
  });

  // Regression for the 401 "amnesia": a turn that throws before delivering any
  // reply must not persist an empty-assistant L2 row (which would poison recall +
  // the rebuilt window) and must roll its dangling user message out of history.
  test('a turn that fails before any reply leaves no L2 row and rolls history back', async () => {
    const session = getSession('r2');
    const historyBefore = session.history.length;

    const events: ServerEvent[] = [];
    const provider = new MockProvider([[{ kind: 'thinking_delta', text: '__THROW__' }]]);

    await expect(
      runTurn({
        session,
        turnId: 'rt2',
        userText: 'New version, Luna',
        provider,
        registry: builtinRegistry,
        emit: (e) => events.push(e),
      }),
    ).resolves.toBeDefined();

    expect(events.some((e) => e.type === 'error' && e.code === 'turn_failure')).toBe(true);
    expect(listL2('r2')).toEqual([]); // no empty-assistant row persisted
    expect(session.history.length).toBe(historyBefore); // dangling user message rolled back
  });

  // Regression for the "answer for user question" bug: a stray top-level text leak
  // alongside a real message-tool reply, with a later error so finalize never
  // overwrites state.text — the persisted reply must be the MESSAGE, not the leak.
  test('message-mode: a top-level leak + a later error persists the message reply, not the leak', async () => {
    const session = getSession('r3');
    const provider = new MockProvider([
      [
        { kind: 'text_delta', text: 'answer for user question' }, // top-level LEAK → state.text
        {
          kind: 'message_stop',
          stopReason: 'tool_use',
          toolUses: [
            { id: 'm1', name: 'message', input: { text: 'Good catch — that was today.', is_final: true } },
          ],
          assistantContent: [
            { type: 'text', text: 'answer for user question' },
            {
              type: 'tool_use',
              id: 'm1',
              name: 'message',
              input: { text: 'Good catch — that was today.', is_final: true },
            },
          ] as unknown as Anthropic.ContentBlock[],
          usage: { input_tokens: 1, output_tokens: 1 },
        },
      ],
      [{ kind: 'thinking_delta', text: '__THROW__' }], // round 2 errors → finalize skipped
    ]);

    await runTurn({
      session,
      turnId: 'rt3',
      userText: 'Why is yesterday?',
      provider,
      registry: messageRegistry,
      emit: () => {},
    });

    const rows = listL2('r3');
    expect(rows.length).toBe(1);
    expect(rows[0]!.assistant_text).toBe('Good catch — that was today.'); // the message reply
    expect(rows[0]!.assistant_text).not.toContain('answer for user question'); // NOT the leak
  });
});
