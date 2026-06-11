import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TraceEvent } from '@luna/protocol';
import { MAX_EVENTS_PER_TURN, TraceStore } from './store';

let db: Database;
let store: TraceStore;

beforeEach(() => {
  db = new Database(':memory:', { strict: true });
  db.exec(readFileSync(join(import.meta.dir, 'migrations', '0001_traces.sql'), 'utf8'));
  store = new TraceStore(db);
});

afterEach(() => {
  db.close(false);
});

function nodeEvent(turnId: string, idx: number): TraceEvent {
  return {
    schema_v: 1,
    kind: 'node',
    trace_id: turnId,
    turn_id: turnId,
    session_id: 'sess',
    t_ms: 1000 + idx,
    node_from: 'a',
    node_to: 'b',
  };
}

describe('TraceStore', () => {
  test('records and flushes events in one transaction', () => {
    store.record(nodeEvent('t1', 0));
    store.record(nodeEvent('t1', 1));
    store.flush('t1');

    const rows = store.getEventsByTurn('t1');
    expect(rows.length).toBe(2);
    expect(rows[0]?.kind).toBe('node');
    expect(rows[0]?.t_ms).toBe(1000);
    expect(rows[1]?.t_ms).toBe(1001);
  });

  test('flush of unknown turn is a no-op', () => {
    store.flush('nonexistent');
    expect(store.getEventsByTurn('nonexistent').length).toBe(0);
  });

  test('500-event cap + overflow marker with dropped_count', () => {
    for (let i = 0; i < MAX_EVENTS_PER_TURN + 100; i++) {
      store.record(nodeEvent('big', i));
    }
    store.flush('big');

    const rows = store.getEventsByTurn('big');
    expect(rows.length).toBe(MAX_EVENTS_PER_TURN + 1);
    const overflow = rows.find((r) => r.kind === 'overflow');
    expect(overflow).toBeDefined();
    const parsed = JSON.parse(overflow!.payload_json);
    expect(parsed.dropped_count).toBe(100);
  });

  test('4KB payload truncation produces parseable structured wrapper', () => {
    const big = 'x'.repeat(10000);
    store.record({
      schema_v: 1,
      kind: 'tool',
      trace_id: 't2',
      turn_id: 't2',
      session_id: 'sess',
      t_ms: 1000,
      call_id: 'c1',
      tool_name: 'read_file',
      phase: 'final',
      payload: { content: big },
    });
    store.flush('t2');

    const rows = store.getEventsByTurn('t2');
    const parsed = JSON.parse(rows[0]!.payload_json);
    expect(parsed.truncated).toBe(true);
    expect(parsed.original_bytes).toBeGreaterThan(4096);
    expect(typeof parsed.preview).toBe('string');
  });

  test('listTurns groups and orders by started_ms desc', () => {
    store.record(nodeEvent('early', 0));
    store.flush('early');
    store.record({ ...nodeEvent('late', 0), t_ms: 5000 });
    store.flush('late');

    const turns = store.listTurns();
    expect(turns.length).toBe(2);
    expect(turns[0]?.turn_id).toBe('late');
    expect(turns[1]?.turn_id).toBe('early');
    expect(turns[0]?.event_count).toBe(1);
  });
});
