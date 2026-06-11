import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { closeDb, migrate, openDb } from './sql';

const tmpDirs: string[] = [];

function makeTmp(): string {
  const dir = mkdtempSync(join(tmpdir(), 'luna-sql-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const d of tmpDirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
});

describe('sql', () => {
  test('migrate applies a fresh migration and bumps user_version', () => {
    const dir = makeTmp();
    const migrationsDir = join(dir, 'migrations');
    mkdirSync(migrationsDir);
    writeFileSync(join(migrationsDir, '0001_init.sql'), 'CREATE TABLE t (id INTEGER PRIMARY KEY);');

    const db = openDb(join(dir, 'test.sqlite'));
    const v = migrate(db, migrationsDir);
    expect(v).toBe(1);
    const row = db.prepare('PRAGMA user_version').get() as { user_version: number };
    expect(row.user_version).toBe(1);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='t'")
      .all();
    expect(tables.length).toBe(1);
    closeDb(db);
  });

  test('migrate is idempotent across reopen', () => {
    const dir = makeTmp();
    const migrationsDir = join(dir, 'migrations');
    mkdirSync(migrationsDir);
    writeFileSync(join(migrationsDir, '0001_init.sql'), 'CREATE TABLE t (id INTEGER PRIMARY KEY);');
    const dbPath = join(dir, 'test.sqlite');

    const db1 = openDb(dbPath);
    expect(migrate(db1, migrationsDir)).toBe(1);
    closeDb(db1);

    const db2 = openDb(dbPath);
    expect(migrate(db2, migrationsDir)).toBe(1);
    closeDb(db2);
  });

  test('applies only migrations above current version, in order', () => {
    const dir = makeTmp();
    const migrationsDir = join(dir, 'migrations');
    mkdirSync(migrationsDir);
    writeFileSync(join(migrationsDir, '0001_a.sql'), 'CREATE TABLE a (id INTEGER);');
    const dbPath = join(dir, 'test.sqlite');

    const db1 = openDb(dbPath);
    expect(migrate(db1, migrationsDir)).toBe(1);
    closeDb(db1);

    writeFileSync(join(migrationsDir, '0002_b.sql'), 'CREATE TABLE b (id INTEGER);');
    const db2 = openDb(dbPath);
    expect(migrate(db2, migrationsDir)).toBe(2);
    const tables = db2
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('a','b')")
      .all();
    expect(tables.length).toBe(2);
    closeDb(db2);
  });

  test('WAL mode is enabled', () => {
    const dir = makeTmp();
    const db = openDb(join(dir, 'wal.sqlite'));
    const row = db.prepare('PRAGMA journal_mode').get() as { journal_mode: string };
    expect(row.journal_mode).toBe('wal');
    closeDb(db);
  });
});
