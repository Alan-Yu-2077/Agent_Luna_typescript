import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import { migrate } from '../sql';
import { setMemoryDb } from './sessionStore';
import { listRecentDiaries, renderDiaryDigest } from './diaries';

let db: Database;

function insertDiary(kind: string, periodKey: string, text: string, genMs: number): void {
  db.prepare('INSERT INTO diaries (kind, period_key, text, generated_ms) VALUES (?, ?, ?, ?)').run(
    kind,
    periodKey,
    text,
    genMs,
  );
}

beforeEach(() => {
  db = new Database(':memory:', { strict: true });
  migrate(db, join(import.meta.dir, '..', 'migrations'));
  setMemoryDb(db);
  Bun.env['LUNA_DIARY_INJECT'] = '1';
});

afterEach(() => {
  setMemoryDb(null);
  db.close(false);
  delete Bun.env['LUNA_DIARY_INJECT'];
  delete Bun.env['LUNA_DIARY_DIGEST_ENTRY_CHARS'];
});

describe('renderDiaryDigest (v0.17.1)', () => {
  test('empty-safe: no diaries → empty string, no crash', () => {
    expect(renderDiaryDigest()).toBe('');
  });

  test('off by default: LUNA_DIARY_INJECT unset → empty even with diaries', () => {
    delete Bun.env['LUNA_DIARY_INJECT'];
    insertDiary('day', '2026-06-15', 'a calm day', 1000);
    expect(renderDiaryDigest()).toBe('');
  });

  test('pulls the latest day / week / month', () => {
    insertDiary('day', '2026-06-14', 'older day', 1000);
    insertDiary('day', '2026-06-15', 'newest day', 2000);
    insertDiary('week', '2026-W24', 'the week', 1500);
    insertDiary('month', '2026-06', 'the month', 1800);
    const digest = renderDiaryDigest();
    expect(digest).toContain('[day 2026-06-15] newest day');
    expect(digest).not.toContain('older day');
    expect(digest).toContain('[week 2026-W24]');
    expect(digest).toContain('[month 2026-06]');
  });

  test('bounded: each entry is truncated to the cap', () => {
    Bun.env['LUNA_DIARY_DIGEST_ENTRY_CHARS'] = '10';
    insertDiary('day', '2026-06-15', 'x'.repeat(500), 1000);
    const digest = renderDiaryDigest();
    expect(digest).toContain('[day 2026-06-15] xxxxxxxxxx');
    expect(digest).not.toContain('x'.repeat(11));
  });
});

describe('listRecentDiaries (v0.17.1)', () => {
  test('newest-first, limited', () => {
    insertDiary('day', '2026-06-13', 'd1', 1000);
    insertDiary('day', '2026-06-14', 'd2', 2000);
    insertDiary('day', '2026-06-15', 'd3', 3000);
    const rows = listRecentDiaries(2);
    expect(rows.map((r) => r.text)).toEqual(['d3', 'd2']);
  });
});
