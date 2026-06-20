import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type Anthropic from '@anthropic-ai/sdk';
import { MockProvider } from '../provider/mock';
import type { ProviderEvent } from '../provider/types';
import { builtinRegistry } from '../tools/registry';
import { getSession, resetSessions } from '../turn/session';
import { runTurn } from '../turn/runTurn';
import { TraceStore } from './store';
import { flushTrace, setTraceStore } from './instrument';

let db: Database;
let store: TraceStore;

beforeEach(() => {
  db = new Database(':memory:', { strict: true });
  db.exec(readFileSync(join(import.meta.dir, '..', 'migrations', '0001_traces.sql'), 'utf8'));
  store = new TraceStore(db);
  setTraceStore(store);
  delete Bun.env['LUNA_TRACE'];
  resetSessions();
});

afterEach(() => {
  setTraceStore(null);
  delete Bun.env['LUNA_TRACE'];
  db.close(false);
});

function toolThenEnd(): ProviderEvent[][] {
  const toolContent = [
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

describe('trace instrumentation through runTurn', () => {
  test('a real turn produces node + tool + outbound rows, all keyed by turn_id', async () => {
    const session = getSession('test');
    await runTurn({
      session,
      turnId: 't1',
      userText: 'what time',
      provider: new MockProvider(toolThenEnd()),
      registry: builtinRegistry,
      emit: () => {},
    });

    const rows = store.getEventsByTurn('t1');
    expect(rows.length).toBeGreaterThanOrEqual(5);

    const kinds = new Set(rows.map((r) => r.kind));
    expect(kinds.has('node')).toBe(true);
    expect(kinds.has('tool')).toBe(true);
    expect(kinds.has('outbound')).toBe(true);

    for (const r of rows) {
      const parsed = JSON.parse(r.payload_json);
      expect(parsed.trace_id).toBe('t1');
      expect(parsed.turn_id).toBe('t1');
    }

    const turns = store.listTurns();
    expect(turns[0]?.turn_id).toBe('t1');
  });

  test('LUNA_TRACE=0 → no rows written (explicit opt-out)', async () => {
    Bun.env['LUNA_TRACE'] = '0';
    const session = getSession('test');
    await runTurn({
      session,
      turnId: 't2',
      userText: 'hi',
      provider: new MockProvider([
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
      ]),
      registry: builtinRegistry,
      emit: () => {},
    });
    expect(store.getEventsByTurn('t2').length).toBe(0);
  });

  // v0.20.8 — tracing must never abort the work it instruments: a flush that throws
  // (e.g. a closed/locked DB) is swallowed, so a dream/proactive pass survives.
  test('flushTrace never throws even when the underlying flush fails', () => {
    store.record({
      schema_v: 1,
      kind: 'decision',
      trace_id: 'x',
      turn_id: 'x',
      session_id: 's',
      t_ms: 1,
      surface: 'proactive_wake',
      decision: 'hold',
      reason: 'test',
      evidence: {},
    });
    db.close(false); // make the next flush() throw
    expect(() => flushTrace('x')).not.toThrow();
  });
});
