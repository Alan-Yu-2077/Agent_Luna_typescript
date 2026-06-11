import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TraceEvent } from '@luna/protocol';
import { TraceStore } from './store';
import { traceViewerHandler } from './viewer';

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

function seed(turnId: string, tMs: number): void {
  const e: TraceEvent = {
    schema_v: 1,
    kind: 'node',
    trace_id: turnId,
    turn_id: turnId,
    session_id: 'sess',
    t_ms: tMs,
    node_from: 'a',
    node_to: 'b',
  };
  store.record(e);
  store.flush(turnId);
}

describe('traceViewerHandler', () => {
  test('GET /_trace returns HTML 200', () => {
    const res = traceViewerHandler(new Request('http://x/_trace'), store);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(200);
    expect(res!.headers.get('content-type')).toContain('text/html');
  });

  test('GET /_trace/api/turns returns turns newest-first', async () => {
    seed('early', 1000);
    seed('late', 5000);
    const res = traceViewerHandler(new Request('http://x/_trace/api/turns'), store);
    const body = (await res!.json()) as { turns: { turn_id: string }[] };
    expect(body.turns.length).toBe(2);
    expect(body.turns[0]?.turn_id).toBe('late');
  });

  test('GET /_trace/api/events returns parsed events ascending', async () => {
    seed('t1', 1000);
    const res = traceViewerHandler(new Request('http://x/_trace/api/events?turn_id=t1'), store);
    const body = (await res!.json()) as { events: { kind: string; payload: unknown }[] };
    expect(body.events.length).toBe(1);
    expect(body.events[0]?.kind).toBe('node');
    expect((body.events[0]?.payload as { node_to: string }).node_to).toBe('b');
  });

  test('unknown /_trace path → 404', () => {
    const res = traceViewerHandler(new Request('http://x/_trace/nope'), store);
    expect(res!.status).toBe(404);
  });

  test('non-/_trace path → null (falls through to WS upgrade)', () => {
    const res = traceViewerHandler(new Request('http://x/'), store);
    expect(res).toBeNull();
  });
});
