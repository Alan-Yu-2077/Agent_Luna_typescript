import { describe, expect, test } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { atomicWrite, findEditMatch, renameAtomic } from './editCore';

describe('findEditMatch — fuzzy uniqueness (v0.20.7)', () => {
  test('two distinct-indentation fuzzy windows → occurrences>1 (guard fires); count=verbatim', () => {
    const content = [
      'function a() {',
      '    foo();',
      '    bar();',
      '}',
      'function b() {',
      '        foo();',
      '        bar();',
      '}',
    ].join('\n');
    const old = '  foo();\n  bar();'; // 2-space: not verbatim in either region
    const m = findEditMatch(content, old);
    expect(m.found).toBe(true);
    if (!m.found) return;
    expect(m.fuzzed).toBe(true);
    expect(m.occurrences).toBeGreaterThan(1); // ambiguous → uniqueness guard must fire
    expect(m.count).toBe(1); // only the FIRST window is verbatim (replace_all consistency)
  });

  test('identical windows → count == occurrences (replace_all stays consistent)', () => {
    const m = findEditMatch('x();\nx();\nx();', 'x();');
    expect(m.found).toBe(true);
    if (!m.found) return;
    expect(m.count).toBe(3);
    expect(m.occurrences).toBe(3);
  });

  test('a single exact match is unique', () => {
    const m = findEditMatch('const a = 1;\nconst b = 2;', 'const a = 1;');
    expect(m.found).toBe(true);
    if (!m.found) return;
    expect(m.occurrences).toBe(1);
    expect(m.count).toBe(1);
  });
});

describe('atomicWrite (v0.20.7)', () => {
  test('writes the content and leaves no temp file behind', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'luna-aw-'));
    const target = join(dir, 'f.txt');
    await atomicWrite(target, 'hello');
    expect(readFileSync(target, 'utf8')).toBe('hello');
    expect(readdirSync(dir).filter((n) => n.includes('luna-tmp')).length).toBe(0);
    rmSync(dir, { recursive: true, force: true });
  });

  test('a failed rename leaves the original intact and cleans up the temp', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'luna-aw-'));
    const target = join(dir, 'sub'); // a NON-EMPTY directory — rename a file onto it fails
    mkdirSync(target);
    writeFileSync(join(target, 'keep.txt'), 'x');
    let threw = false;
    try {
      await atomicWrite(target, 'overwrite');
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
    expect(existsSync(join(target, 'keep.txt'))).toBe(true); // original untouched
    expect(readdirSync(dir).filter((n) => n.includes('luna-tmp')).length).toBe(0); // temp removed
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('renameAtomic — win32 EPERM retry (v0.38.5)', () => {
  const err = (code: string): NodeJS.ErrnoException => Object.assign(new Error(code), { code });

  test('win32: an EPERM (locked target) retries and then succeeds', async () => {
    let calls = 0;
    const sleeps: number[] = [];
    await renameAtomic('a', 'b', {
      platform: 'win32',
      sleep: async (ms) => void sleeps.push(ms),
      rename: async () => {
        calls++;
        if (calls === 1) throw err('EPERM');
      },
    });
    expect(calls).toBe(2);
    expect(sleeps).toEqual([25]); // one backoff before the successful retry
  });

  test('win32: EPERM on every attempt → throws after the bounded retries (3 tries)', async () => {
    let calls = 0;
    let threw = false;
    try {
      await renameAtomic('a', 'b', {
        platform: 'win32',
        sleep: async () => {},
        rename: async () => {
          calls++;
          throw err('EBUSY');
        },
      });
    } catch (e) {
      threw = true;
      expect((e as NodeJS.ErrnoException).code).toBe('EBUSY');
    }
    expect(threw).toBe(true);
    expect(calls).toBe(3); // initial + 2 retries
  });

  test('POSIX: the first error rethrows immediately — no retries (behavior unchanged)', async () => {
    let calls = 0;
    let threw = false;
    try {
      await renameAtomic('a', 'b', {
        platform: 'darwin',
        rename: async () => {
          calls++;
          throw err('EPERM');
        },
      });
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
    expect(calls).toBe(1);
  });

  test('win32: a NON-lock error (ENOENT) rethrows immediately, not retried', async () => {
    let calls = 0;
    await renameAtomic('a', 'b', { platform: 'win32', rename: async () => void calls++ }); // sanity: success path
    expect(calls).toBe(1);
    calls = 0;
    let threw = false;
    try {
      await renameAtomic('a', 'b', {
        platform: 'win32',
        rename: async () => {
          calls++;
          throw err('ENOENT');
        },
      });
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
    expect(calls).toBe(1);
  });
});
