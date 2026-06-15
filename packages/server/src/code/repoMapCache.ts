// mtime-keyed symbol cache (Initiative 8, v0.15.3). Wraps the `repo_map` table
// (migration 0008) so repo_map / find_symbol re-parse only changed files. Reuses
// the shared memory DB connection (getMemoryDb) exactly like l3Store — when the
// DB is unset (tests, LUNA_PERSIST=0) every call no-ops and the caller parses
// fresh each time (correct, just uncached).

import { getMemoryDb } from '../memory/sessionStore';
import type { FileSymbols } from './symbols';

// What we persist per file. `verified` rides along so a cached entry remembers
// whether tree-sitter or the regex fallback produced it.
export type CachedFile = {
  defs: FileSymbols['defs'];
  refs: FileSymbols['refs'];
  verified: boolean;
};

type Row = { path: string; mtime_ms: number; size: number; symbols_json: string };

// Look up a cached parse for `path`. Returns null on a miss OR a staleness hit
// (the stored mtime/size differs from the live stat the caller passes in), so a
// touched file always re-parses.
export function getCached(path: string, mtimeMs: number, size: number): CachedFile | null {
  const db = getMemoryDb();
  if (!db) return null;
  const row = db
    .prepare('SELECT path, mtime_ms, size, symbols_json FROM repo_map WHERE path = ?')
    .get(path) as Row | null;
  if (!row) return null;
  if (row.mtime_ms !== mtimeMs || row.size !== size) return null;
  try {
    return JSON.parse(row.symbols_json) as CachedFile;
  } catch {
    return null;
  }
}

export function putCached(
  path: string,
  mtimeMs: number,
  size: number,
  value: CachedFile,
  nowMs: number,
): void {
  const db = getMemoryDb();
  if (!db) return;
  db.prepare(
    `INSERT INTO repo_map (path, mtime_ms, size, symbols_json, parsed_ms)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(path) DO UPDATE SET
       mtime_ms = excluded.mtime_ms,
       size = excluded.size,
       symbols_json = excluded.symbols_json,
       parsed_ms = excluded.parsed_ms`,
  ).run(path, mtimeMs, size, JSON.stringify(value), nowMs);
}

// Test/maintenance: clear the whole cache (used by tests; never wired to a tool).
export function clearRepoMapCache(): void {
  const db = getMemoryDb();
  if (!db) return;
  db.prepare('DELETE FROM repo_map').run();
}
