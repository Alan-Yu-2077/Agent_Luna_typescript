import type { Database } from 'bun:sqlite';
import type { TraceEvent } from '@luna/protocol';
import { TRACE_SCHEMA_V } from '@luna/protocol';

export const MAX_EVENTS_PER_TURN = 500;
const MAX_PAYLOAD_BYTES = 4096;

// A4 (v0.16.1): keep traces bounded. An always-on companion (proactive turns +
// dreams) writes traces indefinitely; retain only the most-recent N turns,
// pruned periodically off the flush path so it costs nothing per turn.
const RETENTION_TURNS = Number(Bun.env['LUNA_TRACE_RETENTION_TURNS'] ?? 1000);
const PRUNE_EVERY_FLUSHES = 200;

type TurnRow = {
  turn_id: string;
  session_id: string;
  started_ms: number;
  ended_ms: number;
  event_count: number;
};

type EventRow = {
  kind: string;
  payload_json: string;
  t_ms: number;
};

// Truncates an over-large payload into a structured, still-parseable wrapper.
// Never byte-slices the serialized JSON (Q4 resolution).
function clampPayload(json: string): string {
  if (json.length <= MAX_PAYLOAD_BYTES) return json;
  return JSON.stringify({
    truncated: true,
    original_bytes: json.length,
    preview: json.slice(0, MAX_PAYLOAD_BYTES),
  });
}

export class TraceStore {
  private buffers = new Map<string, TraceEvent[]>();
  private dropped = new Map<string, number>();
  private flushCount = 0;

  constructor(private db: Database) {}

  // A4: drop traces for all but the most-recent `keep` turns (by last activity).
  // Exposed for tests + the dream cycle; also called throttled from flush().
  pruneToRetention(keep = RETENTION_TURNS): number {
    if (keep <= 0) return 0;
    return this.db
      .prepare(
        `DELETE FROM traces WHERE turn_id NOT IN (
           SELECT turn_id FROM traces GROUP BY turn_id ORDER BY MAX(t_ms) DESC LIMIT ?
         )`,
      )
      .run(keep).changes;
  }

  record(event: TraceEvent): void {
    const buf = this.buffers.get(event.turn_id) ?? [];
    if (buf.length >= MAX_EVENTS_PER_TURN) {
      this.dropped.set(event.turn_id, (this.dropped.get(event.turn_id) ?? 0) + 1);
      return;
    }
    buf.push(event);
    this.buffers.set(event.turn_id, buf);
  }

  flush(turnId: string): void {
    const buf = this.buffers.get(turnId);
    this.buffers.delete(turnId);
    const droppedCount = this.dropped.get(turnId) ?? 0;
    this.dropped.delete(turnId);
    if (!buf || buf.length === 0) return;

    const insert = this.db.prepare(
      'INSERT INTO traces (schema_v, trace_id, turn_id, session_id, kind, payload_json, t_ms) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    const last = buf[buf.length - 1];

    this.db.transaction(() => {
      for (const e of buf) {
        insert.run(
          e.schema_v,
          e.trace_id,
          e.turn_id,
          e.session_id,
          e.kind,
          clampPayload(JSON.stringify(e)),
          e.t_ms,
        );
      }
      if (droppedCount > 0 && last) {
        insert.run(
          TRACE_SCHEMA_V,
          last.trace_id,
          last.turn_id,
          last.session_id,
          'overflow',
          JSON.stringify({
            schema_v: TRACE_SCHEMA_V,
            kind: 'overflow',
            trace_id: last.trace_id,
            turn_id: last.turn_id,
            session_id: last.session_id,
            t_ms: last.t_ms,
            dropped_count: droppedCount,
          }),
          last.t_ms,
        );
      }
    })();

    // A4: prune periodically (not every flush) so retention costs ~nothing per turn.
    this.flushCount += 1;
    if (this.flushCount % PRUNE_EVERY_FLUSHES === 0) this.pruneToRetention();
  }

  listTurns(limit = 50): TurnRow[] {
    return this.db
      .prepare(
        `SELECT turn_id,
                session_id,
                MIN(t_ms) AS started_ms,
                MAX(t_ms) AS ended_ms,
                COUNT(*)  AS event_count
         FROM traces
         GROUP BY turn_id
         ORDER BY started_ms DESC
         LIMIT ?`,
      )
      .all(limit) as TurnRow[];
  }

  getEventsByTurn(turnId: string): EventRow[] {
    return this.db
      .prepare('SELECT kind, payload_json, t_ms FROM traces WHERE turn_id = ? ORDER BY t_ms ASC, id ASC')
      .all(turnId) as EventRow[];
  }
}
