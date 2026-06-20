import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate } from '../sql';
import { setMemoryDb } from '../memory/sessionStore';
import { buildRepoMap, renderRepoMap, type StatFn } from './repoMap';
import { clearRepoMapCache } from './repoMapCache';
import { resetTreeSitterForTests } from './treeSitter';

let tmp: string;
let db: Database;

beforeEach(() => {
  db = new Database(':memory:', { strict: true });
  migrate(db, join(import.meta.dir, '..', 'migrations'));
  setMemoryDb(db);
  resetTreeSitterForTests();
  tmp = mkdtempSync(join(tmpdir(), 'luna-repomap-'));
  mkdirSync(join(tmp, 'src'), { recursive: true });
});

afterEach(() => {
  setMemoryDb(null);
  db.close(false);
  rmSync(tmp, { recursive: true, force: true });
});

describe('buildRepoMap — symbol extraction', () => {
  test('parses a small TS tree into the expected symbol set', async () => {
    writeFileSync(
      join(tmp, 'src', 'core.ts'),
      'export function dispatch(x: number) { return x; }\n' +
        'export class Engine {}\n' +
        'export interface Spec { id: string }\n' +
        'export type Id = string;\n' +
        'const helper = () => 1;\n',
    );
    const map = await buildRepoMap({ root: tmp });
    expect(map.verified).toBe(true); // tree-sitter grammar present → verified
    const names = map.entries.map((e) => e.symbol).sort();
    expect(names).toContain('dispatch');
    expect(names).toContain('Engine');
    expect(names).toContain('Spec');
    expect(names).toContain('Id');
    expect(names).toContain('helper');
    const dispatch = map.entries.find((e) => e.symbol === 'dispatch');
    expect(dispatch?.kind).toBe('function');
    expect(dispatch?.exported).toBe(true);
    expect(dispatch?.line).toBe(1);
  });

  // v0.20.7 — a method of an exported class is NOT itself "exported" (isExported
  // used to climb past the class body to the class's export_statement).
  test('a method of an exported class is not marked exported', async () => {
    writeFileSync(join(tmp, 'k.ts'), 'export class Engine {\n  run() { return 1; }\n}\n');
    const map = await buildRepoMap({ root: tmp });
    expect(map.entries.find((e) => e.symbol === 'Engine')?.exported).toBe(true);
    const run = map.entries.find((e) => e.symbol === 'run');
    expect(run).toBeDefined();
    expect(run?.exported).toBe(false);
  });

  test('ranks the most-referenced symbol first', async () => {
    // `central` is defined in central.ts and referenced from two other files;
    // `lonely` is defined and never referenced. central must outrank lonely.
    writeFileSync(join(tmp, 'src', 'central.ts'), 'export function central() { return 1; }\n');
    writeFileSync(join(tmp, 'src', 'lonely.ts'), 'export function lonely() { return 2; }\n');
    writeFileSync(join(tmp, 'src', 'a.ts'), 'import { central } from "./central";\ncentral();\n');
    writeFileSync(join(tmp, 'src', 'b.ts'), 'import { central } from "./central";\nconst y = central();\n');

    const map = await buildRepoMap({ root: tmp });
    const centralIdx = map.entries.findIndex((e) => e.symbol === 'central');
    const lonelyIdx = map.entries.findIndex((e) => e.symbol === 'lonely');
    expect(centralIdx).toBeGreaterThanOrEqual(0);
    expect(lonelyIdx).toBeGreaterThanOrEqual(0);
    expect(centralIdx).toBeLessThan(lonelyIdx);
  });
});

describe('buildRepoMap — mtime cache', () => {
  test('returns cached on an unchanged file, re-parses on a touch (injected stat)', async () => {
    const file = join(tmp, 'src', 'cached.ts');
    writeFileSync(file, 'export function one() {}\n');

    // injected stat: mtime is whatever the harness says, so we control staleness.
    let mtime = 1000;
    const statFn: StatFn = () => ({ mtimeMs: mtime, size: 42 });

    const first = await buildRepoMap({ root: tmp, statFn });
    expect(first.files_parsed).toBe(1); // cold: parsed

    // second run, same mtime → served from cache, nothing re-parsed
    const second = await buildRepoMap({ root: tmp, statFn });
    expect(second.files_parsed).toBe(0);
    expect(second.entries.some((e) => e.symbol === 'one')).toBe(true);

    // touch: bump the injected mtime → cache is stale → re-parse
    mtime = 2000;
    // also change the file content so the new parse differs
    writeFileSync(file, 'export function two() {}\n');
    const third = await buildRepoMap({ root: tmp, statFn });
    expect(third.files_parsed).toBe(1);
    expect(third.entries.some((e) => e.symbol === 'two')).toBe(true);
    expect(third.entries.some((e) => e.symbol === 'one')).toBe(false);
  });

  test('a clear empties the cache (next run re-parses)', async () => {
    writeFileSync(join(tmp, 'src', 'x.ts'), 'export const a = 1;\n');
    const statFn: StatFn = () => ({ mtimeMs: 5, size: 5 });
    await buildRepoMap({ root: tmp, statFn });
    const cachedRun = await buildRepoMap({ root: tmp, statFn });
    expect(cachedRun.files_parsed).toBe(0);
    clearRepoMapCache();
    const afterClear = await buildRepoMap({ root: tmp, statFn });
    expect(afterClear.files_parsed).toBe(1);
  });
});

describe('buildRepoMap — token budget', () => {
  test('a tiny budget truncates and renderRepoMap marks it', async () => {
    // many symbols, a budget too small to hold them all
    const lines: string[] = [];
    for (let i = 0; i < 40; i++) lines.push(`export function fn${i}() { return ${i}; }`);
    writeFileSync(join(tmp, 'src', 'many.ts'), lines.join('\n') + '\n');

    const full = await buildRepoMap({ root: tmp, maxTokens: 8000 });
    const tiny = await buildRepoMap({ root: tmp, maxTokens: 100 });

    expect(tiny.entries.length).toBeLessThan(full.entries.length);
    expect(tiny.truncated).toBe(true);
    expect(renderRepoMap(tiny)).toContain('truncated');
  });
});

describe('renderRepoMap', () => {
  test('empty result renders a placeholder', () => {
    expect(
      renderRepoMap({ entries: [], files_scanned: 0, files_parsed: 0, truncated: false, verified: false }),
    ).toBe('(no symbols found)');
  });
});
