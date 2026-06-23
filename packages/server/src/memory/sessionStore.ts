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

// All persisted session ids — used to warm the in-memory session map at boot
// (Initiative 14, v0.21.6) so the proactive scheduler considers them after a
// restart without waiting for the next user message.
export function listSessionIds(): string[] {
  if (!db) return [];
  return (db.prepare('SELECT id FROM sessions').all() as { id: string }[]).map((r) => r.id);
}

// The t_ms of the most recent NON-proactive (user) L2 turn — restores the
// proactive idle-gap / deep-absence anchor across a restart (her own proactive
// turns are lull anchoring, not user activity). null = no user turn persisted.
export function lastUserTurnMs(sessionId: string): number | null {
  if (!db) return null;
  const row = db
    .prepare(
      "SELECT t_ms FROM l2_turns WHERE session_id = ? AND turn_id NOT LIKE 'proactive%' ORDER BY t_ms DESC, id DESC LIMIT 1",
    )
    .get(sessionId) as { t_ms: number } | null;
  return row?.t_ms ?? null;
}

// CAS commit for the L1 fold: only lands if window_low_water is unchanged since
// the fold snapshotted it. Returns false on a lost race. v0.17.0: the digest is
// REPLACED (not appended) — the compressor re-derives a bounded structured digest
// from the prior one + the new turns, so it never grows unboundedly.
export function commitFold(
  id: string,
  newDigest: string,
  newLowWater: number,
  expectedLowWater: number,
): boolean {
  if (!db) return false;
  const result = db
    .prepare(
      `UPDATE sessions
       SET rolling_summary = ?, window_low_water = ?
       WHERE id = ? AND window_low_water = ?`,
    )
    .run(newDigest, newLowWater, id, expectedLowWater);
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
  importance: number | null;
};

// Ascending (oldest→newest) — the frame loadSession/planFold index against, where
// window_low_water is an ABSOLUTE cumulative offset from the front. An explicit
// limit (with this ASC order) would drop the NEWEST rows and shift that offset, so
// the once-per-boot/fold load takes NO limit (loads the whole timeline). A caller
// that genuinely wants a bounded NEWEST window uses listRecentL2 instead.
export function listL2(sessionId: string, opts?: { limit?: number }): L2Row[] {
  if (!db) return [];
  if (opts?.limit != null) {
    return db
      .prepare('SELECT * FROM l2_turns WHERE session_id = ? ORDER BY t_ms ASC, id ASC LIMIT ?')
      .all(sessionId, opts.limit) as L2Row[];
  }
  return db
    .prepare('SELECT * FROM l2_turns WHERE session_id = ? ORDER BY t_ms ASC, id ASC')
    .all(sessionId) as L2Row[];
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

// v0.20.8: the most-recent SPOKEN self-initiated openers (proactive + continuation
// turns persist under a `proactive:` turn_id; silent ones leave no row), so the
// wake gate can tell Luna not to repeat them.
export function listRecentProactiveTexts(sessionId: string, limit: number): string[] {
  if (!db) return [];
  const rows = db
    .prepare(
      "SELECT assistant_text FROM l2_turns WHERE session_id = ? AND turn_id LIKE 'proactive:%' AND assistant_text != '' ORDER BY t_ms DESC LIMIT ?",
    )
    .all(sessionId, limit) as { assistant_text: string }[];
  return rows.map((r) => r.assistant_text);
}

// v0.17.0 (Initiative 10): turns not yet rated for salience (importance IS NULL),
// most-recent first — the dream cycle rates these 1–5.
export function listUnratedL2(sessionId: string, limit: number): L2Row[] {
  if (!db) return [];
  return db
    .prepare(
      'SELECT * FROM l2_turns WHERE session_id = ? AND importance IS NULL ORDER BY t_ms DESC, id DESC LIMIT ?',
    )
    .all(sessionId, limit) as L2Row[];
}

// Store a turn's salience score (1–5).
export function setImportance(id: number, score: number): void {
  if (!db) return;
  db.prepare('UPDATE l2_turns SET importance = ? WHERE id = ?').run(score, id);
}
