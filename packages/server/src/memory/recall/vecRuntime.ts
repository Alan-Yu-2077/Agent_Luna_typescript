import { existsSync } from 'node:fs';
import { Database } from 'bun:sqlite';
import * as sqliteVec from 'sqlite-vec';

const CUSTOM_SQLITE = '/opt/homebrew/opt/sqlite/lib/libsqlite3.dylib';

let customSet = false;
let vecLoaded: boolean | null = null;

// macOS system SQLite compiles out extension loading; Bun needs a custom build
// pointed at BEFORE any Database is constructed, process-wide, exactly once.
// Tests get this via bunfig preload; production via the top of main.ts.
export function initCustomSqlite(): boolean {
  if (customSet) return true;
  if (!existsSync(CUSTOM_SQLITE)) return false;
  try {
    Database.setCustomSQLite(CUSTOM_SQLITE);
    customSet = true;
    return true;
  } catch {
    // A Database was already constructed (or already set) — extension loading
    // may still work if a prior call succeeded.
    return customSet;
  }
}

export function markCustomSqliteSet(): void {
  customSet = true;
}

// Loads the sqlite-vec extension on a connection. Returns false (and remembers)
// when the platform can't load extensions — recall falls back to TS cosine.
export function tryLoadVec(db: Database): boolean {
  if (vecLoaded === false) return false;
  try {
    sqliteVec.load(db);
    vecLoaded = true;
    return true;
  } catch {
    vecLoaded = false;
    return false;
  }
}

export function resetVecStateForTests(): void {
  vecLoaded = null;
}
