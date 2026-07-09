// v0.4.3 spike: prove sqlite-vec loads under Bun on macOS and vec0 KNN works.
// Run: bun scripts/spike-sqlite-vec.ts
// GO criteria: load succeeds, insert 4 vectors, KNN returns nearest-first.
import { Database } from 'bun:sqlite';
import * as sqliteVec from 'sqlite-vec';
import { resolveSqliteLib } from '../src/memory/recall/vecRuntime';

const lib = resolveSqliteLib();
if (!lib) {
  console.log('[spike] FAIL: no extension-capable SQLite found (set LUNA_SQLITE_LIB)');
  process.exit(1);
}
Database.setCustomSQLite(lib);

const db = new Database(':memory:');
sqliteVec.load(db);

const { vec_version } = db.prepare('SELECT vec_version() AS vec_version').get() as {
  vec_version: string;
};
console.log(`[spike] sqlite-vec loaded: ${vec_version}`);

db.exec('CREATE VIRTUAL TABLE v USING vec0(embedding float[4])');

function blob(arr: number[]): Uint8Array {
  const f = new Float32Array(arr);
  return new Uint8Array(f.buffer, f.byteOffset, f.byteLength);
}

const insert = db.prepare('INSERT INTO v (rowid, embedding) VALUES (?, ?)');
insert.run(1, blob([1, 0, 0, 0]));
insert.run(2, blob([0, 1, 0, 0]));
insert.run(3, blob([0.9, 0.1, 0, 0]));
insert.run(4, blob([0, 0, 1, 0]));

const rows = db
  .prepare('SELECT rowid, distance FROM v WHERE embedding MATCH ? ORDER BY distance LIMIT 3')
  .all(blob([1, 0, 0, 0])) as { rowid: number; distance: number }[];

console.log('[spike] KNN for [1,0,0,0]:', JSON.stringify(rows));
if (rows[0]?.rowid !== 1 || rows[1]?.rowid !== 3) {
  console.log('[spike] FAIL: unexpected KNN ordering');
  process.exit(1);
}
console.log('[spike] PASS — vec0 primary path is GO');
