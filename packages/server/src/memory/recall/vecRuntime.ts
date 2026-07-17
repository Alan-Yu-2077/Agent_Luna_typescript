import { existsSync } from 'node:fs';
import { Database } from 'bun:sqlite';
import * as sqliteVec from 'sqlite-vec';

// Candidate extension-capable SQLite libraries. `LUNA_SQLITE_LIB` overrides; otherwise probe the
// common macOS (arm64/Intel Homebrew) and Linux locations. Mirrors the desktop's multi-candidate
// resolvers. Without this, sqlite-vec loaded only on an arm64-Homebrew macOS box and silently fell
// back to slow TS-cosine recall everywhere else.
const UNIX_SQLITE_CANDIDATES = [
  '/opt/homebrew/opt/sqlite/lib/libsqlite3.dylib', // macOS arm64 Homebrew
  '/usr/local/opt/sqlite/lib/libsqlite3.dylib', // macOS Intel Homebrew
  '/opt/homebrew/lib/libsqlite3.dylib',
  '/usr/lib/x86_64-linux-gnu/libsqlite3.so', // Debian/Ubuntu
  '/usr/lib/libsqlite3.so', // generic Linux
  '/usr/lib64/libsqlite3.so', // Fedora/RHEL
];

// v0.38.5: on win32 there is no standard extension-capable sqlite3.dll install path — Windows'
// system winsqlite3.dll has extension loading compiled OUT, like macOS' system SQLite. So the win32
// mechanism is the LUNA_SQLITE_LIB override pointing at a sqlite-vec-compatible sqlite3.dll
// (sqlite-vec publishes windows-x64 builds; see docs/SETUP.md). Absent → recall degrades to the
// TS-cosine fallback (correct, just slower), as on any un-provisioned box. No dead unix paths tried.
function candidatesFor(platform: NodeJS.Platform): string[] {
  return platform === 'win32' ? [] : UNIX_SQLITE_CANDIDATES;
}

// The first candidate that exists — `LUNA_SQLITE_LIB` first, then the platform list. Pure +
// injectable so it unit-tests; returns null when none is found (recall then degrades to TS-cosine).
export function resolveSqliteLib(
  opts: {
    override?: string;
    candidates?: string[];
    exists?: (p: string) => boolean;
    platform?: NodeJS.Platform;
  } = {},
): string | null {
  const exists = opts.exists ?? existsSync;
  const override = opts.override ?? Bun.env['LUNA_SQLITE_LIB'];
  const cands =
    opts.candidates ?? [...(override ? [override] : []), ...candidatesFor(opts.platform ?? process.platform)];
  for (const p of cands) if (exists(p)) return p;
  return null;
}

let customSet = false;
let vecLoaded: boolean | null = null;

// macOS system SQLite compiles out extension loading; Bun needs a custom build
// pointed at BEFORE any Database is constructed, process-wide, exactly once.
// Tests get this via bunfig preload; production via the top of main.ts.
export function initCustomSqlite(): boolean {
  if (customSet) return true;
  const lib = resolveSqliteLib();
  if (!lib) return false;
  try {
    Database.setCustomSQLite(lib);
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
