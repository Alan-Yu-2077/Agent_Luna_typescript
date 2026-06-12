import type { Database } from 'bun:sqlite';
import type Anthropic from '@anthropic-ai/sdk';
import type { SessionRow } from '@luna/protocol';

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
};

export function loadSession(id: string): PersistedSession | null {
  if (!db) return null;
  const row = db
    .prepare('SELECT id, turn_seq, history_json, updated_ms FROM sessions WHERE id = ?')
    .get(id) as SessionRow | null;
  if (!row) return null;
  return {
    history: JSON.parse(row.history_json) as Anthropic.MessageParam[],
    turnSeq: row.turn_seq,
  };
}

export function persistSession(
  id: string,
  history: Anthropic.MessageParam[],
  turnSeq: number,
): void {
  if (!db) return;
  db.prepare(
    `INSERT INTO sessions (id, turn_seq, history_json, updated_ms)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       turn_seq = excluded.turn_seq,
       history_json = excluded.history_json,
       updated_ms = excluded.updated_ms`,
  ).run(id, turnSeq, JSON.stringify(history), Date.now());
}

export function appendL2(turn: {
  sessionId: string;
  turnId: string;
  userText: string;
  assistantText: string;
  rawContent: unknown;
}): void {
  if (!db) return;
  db.prepare(
    `INSERT INTO l2_turns (session_id, turn_id, t_ms, user_text, assistant_text, raw_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    turn.sessionId,
    turn.turnId,
    Date.now(),
    turn.userText,
    turn.assistantText,
    JSON.stringify(turn.rawContent),
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
};

export function listL2(sessionId: string, opts?: { limit?: number }): L2Row[] {
  if (!db) return [];
  return db
    .prepare(
      'SELECT * FROM l2_turns WHERE session_id = ? ORDER BY t_ms ASC, id ASC LIMIT ?',
    )
    .all(sessionId, opts?.limit ?? 10000) as L2Row[];
}
