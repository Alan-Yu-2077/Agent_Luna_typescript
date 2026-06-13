import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import type Anthropic from '@anthropic-ai/sdk';
import type { ServerEvent } from '@luna/protocol';
import { migrate } from '../sql';
import { setMemoryDb } from '../memory/sessionStore';
import { MockProvider } from '../provider/mock';
import { builtinRegistry } from '../tools/registry';
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
    const session = getSession('r1'); // load while the table exists
    db.exec('DROP TABLE l2_turns'); // now appendL2 will throw (no such table)

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
});
