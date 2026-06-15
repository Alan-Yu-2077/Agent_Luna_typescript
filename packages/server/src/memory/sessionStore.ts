import type { Database } from 'bun:sqlite';
import type Anthropic from '@anthropic-ai/sdk';
import { contentHash } from './recall/embed';

let db: Database | null = null;

// Injection seam mirroring setTraceStore: unset (tests, LUNA_PERSIST=0) → all
// functions no-op and sessions stay purely in-memory.
export function setMemoryDb(database: Database | null): void {
  db = database;
}

export function getMemoryDb(): Database | null {
  return db;
}

export type PersistedSession = {
  history: Anthropic.MessageParam[];
  turnSeq: number;
  rollingSummary: string;
  windowLowWater: number;
};

// A3 (v0.16.2): history is rebuilt from the append-only L2 timeline — the source
// of truth — not from a per-turn-rewritten `history_json` blob. Each L2 row's
// raw_json is exactly the messages that turn appended (`history.slice(start)`),
// so concatenating them in order reconstitutes the full history. This keeps
// per-turn persistence O(1) (no full re-serialize) while staying crash-faithful.
export function loadSession(id: string): PersistedSession | null {
  if (!db) return null;
  const row = db
    .prepare('SELECT turn_seq, rolling_summary, window_low_water FROM sessions WHERE id = ?')
    .get(id) as { turn_seq: number; rolling_summary: string; window_low_water: number } | null;
  const history = listL2(id).flatMap((r) => JSON.parse(r.raw_json) as Anthropic.MessageParam[]);
  if (!row && history.length === 0) return null;
  return {
    history,
    turnSeq: row?.turn_seq ?? 0,
    rollingSummary: row?.rolling_summary ?? '',
    windowLowWater: row?.window_low_water ?? 0,
  };
}

// Append-only CAS commit for the L1 fold: only lands if window_low_water is
// unchanged since the fold snapshotted it. Returns false on a lost race.
export function commitFold(
  id: string,
  summaryChunk: string,
  newLowWater: number,
  expectedLowWater: number,
): boolean {
  if (!db) return false;
  const result = db
    .prepare(
      `UPDATE sessions
       SET rolling_summary = rolling_summary || ?, window_low_water = ?
       WHERE id = ? AND window_low_water = ?`,
    )
    .run(summaryChunk, newLowWater, id, expectedLowWater);
  return result.changes === 1;
}

// A3 (v0.16.2): persist only the session bookkeeping (turn_seq + updated_ms); the
// `history_json` blob is no longer the source of truth (L2 is — see loadSession),
// so it is written as a constant placeholder instead of re-serializing the whole
// growing history every turn (the last O(N²) write). `history` is accepted for
// signature compatibility but intentionally unused.
export function persistSession(
  id: string,
  _history: Anthropic.MessageParam[],
  turnSeq: number,
): void {
  if (!db) return;
  db.prepare(
    `INSERT INTO sessions (id, turn_seq, history_json, updated_ms)
     VALUES (?, ?, '[]', ?)
     ON CONFLICT(id) DO UPDATE SET
       turn_seq = excluded.turn_seq,
       updated_ms = excluded.updated_ms`,
  ).run(id, turnSeq, Date.now());
}

export function appendL2(turn: {
  sessionId: string;
  turnId: string;
  userText: string;
  assistantText: string;
  rawContent: unknown;
}): void {
  if (!db) return;
  // A2 (v0.16.1): store the recall content hash (of the exact text recall keys
  // on) at insert, so retrieve() reads it back instead of re-hashing per turn.
  const hash = contentHash(`${turn.userText}\n${turn.assistantText}`);
  db.prepare(
    `INSERT INTO l2_turns (session_id, turn_id, t_ms, user_text, assistant_text, raw_json, content_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    turn.sessionId,
    turn.turnId,
    Date.now(),
    turn.userText,
    turn.assistantText,
    JSON.stringify(turn.rawContent),
    hash,
  );
}

export type L2Row = {
  id: number;
  session_id: string;
  turn_id: string;
  t_ms: number;
  user_text: string;
  assistant_text: string;
  raw_json: string;
  content_hash: string | null;
};

export function listL2(sessionId: string, opts?: { limit?: number }): L2Row[] {
  if (!db) return [];
  return db
    .prepare('SELECT * FROM l2_turns WHERE session_id = ? ORDER BY t_ms ASC, id ASC LIMIT ?')
    .all(sessionId, opts?.limit ?? 10000) as L2Row[];
}

// A2 (v0.16.1): the most-recent `limit` turns in ascending order, read with a
// DESC LIMIT so only those rows are fetched (recall used to pull up to 10 000
// rows to keep the last 500).
export function listRecentL2(sessionId: string, limit: number): L2Row[] {
  if (!db) return [];
  const rows = db
    .prepare('SELECT * FROM l2_turns WHERE session_id = ? ORDER BY t_ms DESC, id DESC LIMIT ?')
    .all(sessionId, limit) as L2Row[];
  return rows.reverse();
}
