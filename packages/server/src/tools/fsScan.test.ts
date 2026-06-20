import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildIgnore, walk } from './fsScan';

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'luna-fsscan-'));
});
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

const opts = (over: Partial<Parameters<typeof walk>[1]> = {}) => ({
  recursive: true,
  includeHidden: false,
  maxEntries: 50000,
  ignore: buildIgnore(tmp),
  ...over,
});

describe('fsScan.walk — symlink handling (v0.20.1)', () => {
  test('a symlinked file is emitted by default (list_files shows it)', async () => {
    writeFileSync(join(tmp, 'real.txt'), 'x');
    symlinkSync(join(tmp, 'real.txt'), join(tmp, 'link.txt'));
    const { entries } = await walk(tmp, opts());
    expect(entries.some((e) => e.rel === 'link.txt')).toBe(true);
  });

  test('excludeSymlinks:true drops symlinked files and dirs', async () => {
    writeFileSync(join(tmp, 'real.txt'), 'x');
    symlinkSync(join(tmp, 'real.txt'), join(tmp, 'link.txt'));
    mkdirSync(join(tmp, 'realdir'));
    symlinkSync(join(tmp, 'realdir'), join(tmp, 'linkdir'));
    const { entries } = await walk(tmp, opts({ excludeSymlinks: true }));
    expect(entries.some((e) => e.rel === 'link.txt')).toBe(false);
    expect(entries.some((e) => e.rel === 'linkdir')).toBe(false);
    expect(entries.some((e) => e.rel === 'real.txt')).toBe(true); // real entries unaffected
  });

  test('a symlinked dir is never descended into (loop/escape safety)', async () => {
    mkdirSync(join(tmp, 'realdir'));
    writeFileSync(join(tmp, 'realdir', 'inner.txt'), 'x');
    symlinkSync(join(tmp, 'realdir'), join(tmp, 'linkdir'));
    const { entries } = await walk(tmp, opts());
    // the link itself may be emitted, but its contents are NOT walked through it
    expect(entries.some((e) => e.rel === join('linkdir', 'inner.txt'))).toBe(false);
  });

  test('exact maxEntries cap (check-before-push boundary)', async () => {
    for (let i = 0; i < 10; i++) writeFileSync(join(tmp, `f${i}.txt`), 'x');
    const { entries, truncated } = await walk(tmp, opts({ maxEntries: 5 }));
    expect(entries.length).toBe(5);
    expect(truncated).toBe(true);
  });
});
