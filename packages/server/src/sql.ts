import { Database } from 'bun:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function openDb(path: string): Database {
  const db = new Database(path, { create: true, strict: true });
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  return db;
}

function userVersion(db: Database): number {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number };
  return row.user_version;
}

// Applies migrations/NNNN_*.sql files whose leading number exceeds the DB's
// current user_version, in ascending order, each followed by a version bump.
// PRAGMA cannot bind params, so the integer is interpolated (it is derived from
// the trusted filename, never user input).
export function migrate(db: Database, migrationsDir: string): number {
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const seen = new Set<number>();
  for (const file of files) {
    const match = file.match(/^(\d+)_/);
    if (!match || !match[1]) continue;
    const version = Number(match[1]);
    if (seen.has(version)) {
      throw new Error(`duplicate migration number ${version} (${file}) — would be silently skipped`);
    }
    seen.add(version);
  }

  let current = userVersion(db);
  for (const file of files) {
    const match = file.match(/^(\d+)_/);
    if (!match || !match[1]) continue;
    const version = Number(match[1]);
    if (version <= current) continue;

    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      db.exec(`PRAGMA user_version = ${version}`);
    })();
    current = version;
  }
  return current;
}

export function closeDb(db: Database): void {
  db.close(false);
}
