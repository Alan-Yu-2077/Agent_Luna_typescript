import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { grepTool, jsRunner, runGrep, setGrepRunnerForTests, type GrepRunner } from './grep';

let tmp: string;
const savedRoot = Bun.env['LUNA_WORKSPACE_ROOT'];

const ctx = () => ({
  sessionId: 'test',
  callId: 'c1',
  abortSignal: new AbortController().signal,
});

type GrepOut = {
  matches: { path: string; line: number; col: number; text: string }[];
  truncated: boolean;
  shown: number;
  total: number;
};
async function run(input: unknown): Promise<{ kind: string; data?: GrepOut; code?: string }> {
  const events: unknown[] = [];
  for await (const e of grepTool.execute(input as never, ctx())) events.push(e);
  return events[0] as { kind: string; data?: GrepOut };
}

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'luna-grep-'));
  Bun.env['LUNA_WORKSPACE_ROOT'] = tmp;
  mkdirSync(join(tmp, 'src'), { recursive: true });
  writeFileSync(join(tmp, 'src', 'a.ts'), 'const Foo = 1;\nfunction bar() {}\nconst foo = 2;\n');
  writeFileSync(join(tmp, 'src', 'b.ts'), 'export const Foo = 99;\n');
  writeFileSync(join(tmp, 'README.md'), 'documentation about Foo and bar\n');
});

afterEach(() => {
  setGrepRunnerForTests(null);
  if (savedRoot === undefined) delete Bun.env['LUNA_WORKSPACE_ROOT'];
  else Bun.env['LUNA_WORKSPACE_ROOT'] = savedRoot;
  rmSync(tmp, { recursive: true, force: true });
});

// Force the JS fallback for deterministic, native-rg-independent assertions.
function forceJsFallback(): void {
  const failing: GrepRunner = async () => {
    throw new Error('rg absent');
  };
  setGrepRunnerForTests(failing);
}

describe('grep (JS fallback path — rg injected as absent)', () => {
  test('literal search is case-insensitive by default', async () => {
    forceJsFallback();
    const e = await run({ query: 'foo' });
    expect(e.kind).toBe('ok');
    // Foo (a.ts), foo (a.ts), Foo (b.ts), Foo (README.md) = 4
    expect(e.data!.total).toBe(4);
    expect(e.data!.matches.every((m) => m.line > 0 && m.col > 0)).toBe(true);
  });

  test('case_sensitive narrows the match set', async () => {
    forceJsFallback();
    const e = await run({ query: 'Foo', case_sensitive: true });
    // Foo (a.ts), Foo (b.ts), Foo (README.md) = 3 (lowercase foo excluded)
    expect(e.data!.total).toBe(3);
  });

  test('regex search matches a pattern', async () => {
    forceJsFallback();
    const e = await run({ query: 'function\\s+\\w+', regex: true });
    expect(e.data!.total).toBe(1);
    expect(e.data!.matches[0]!.text).toContain('function bar');
  });

  test('glob restricts the file set', async () => {
    forceJsFallback();
    const e = await run({ query: 'Foo', glob: '**/*.ts' });
    // README.md excluded → 3 (Foo a.ts, foo a.ts, Foo b.ts)
    expect(e.data!.total).toBe(3);
  });

  test('capped results report shown/total/truncated', async () => {
    forceJsFallback();
    const e = await run({ query: 'foo', max_results: 1 });
    expect(e.data!.shown).toBe(1);
    expect(e.data!.total).toBe(4);
    expect(e.data!.truncated).toBe(true);
  });
});

describe('grep runner fallback parity', () => {
  test('runGrep falls back to jsRunner when the primary throws, same shape', async () => {
    const failing: GrepRunner = async () => {
      throw new Error('boom');
    };
    const viaFallback = await runGrep(
      { query: 'Foo', root: tmp, regex: false, caseSensitive: true, cap: 100 },
      failing,
    );
    const direct = await jsRunner({
      query: 'Foo',
      root: tmp,
      regex: false,
      caseSensitive: true,
      cap: 100,
    });
    expect(viaFallback.total).toBe(direct.total);
    expect(viaFallback.hits.length).toBe(direct.hits.length);
    expect(Object.keys(viaFallback.hits[0]!).sort()).toEqual(['col', 'line', 'path', 'text']);
  });
});

describe('grep schema + safety', () => {
  test('empty query rejected; max_results bounds enforced', () => {
    expect(grepTool.input.safeParse({ query: '' }).success).toBe(false);
    expect(grepTool.input.safeParse({ query: 'x', max_results: 0 }).success).toBe(false);
    expect(grepTool.input.safeParse({ query: 'x', max_results: 3000 }).success).toBe(false);
    expect(grepTool.input.safeParse({ query: 'x' }).success).toBe(true);
  });

  test('searching a secret path is rejected', async () => {
    const e = await run({ query: 'anything', path: '.env' });
    expect(e.kind).toBe('err');
  });

  // v0.20.1 — the JS fallback must not surface secret bytes: a direct secret-pattern
  // file (caught by the per-file resolveInWorkspace gate) nor a symlink-to-secret
  // outside the tree (caught by excludeSymlinks).
  test('JS scan surfaces neither a secret-pattern file nor a symlink-to-secret', async () => {
    forceJsFallback();
    writeFileSync(join(tmp, 'src', 'leaked.pem'), 'SUPERSECRET_TOKEN\n'); // per-file gate
    const outside = mkdtempSync(join(tmpdir(), 'luna-grep-secret-'));
    writeFileSync(join(outside, 'key.pem'), 'SUPERSECRET_TOKEN\n');
    symlinkSync(join(outside, 'key.pem'), join(tmp, 'src', 'innocent.txt')); // excludeSymlinks
    const e = await run({ query: 'SUPERSECRET_TOKEN' });
    rmSync(outside, { recursive: true, force: true });
    expect(e.kind).toBe('ok');
    expect(e.data!.total).toBe(0);
  });

  test('summarize reports shown of total', () => {
    expect(grepTool.summarize({ matches: [], truncated: true, shown: 5, total: 20 })).toContain(
      '5 of 20',
    );
  });

  // v0.20.2 — the JS walk honors the abort signal (dispatcher timeout) instead of
  // scanning the whole tree after the turn is gone.
  test('jsRunner stops immediately on an already-aborted signal', async () => {
    const r = await jsRunner({
      query: 'Foo',
      root: tmp,
      regex: false,
      caseSensitive: false,
      cap: 100,
      abortSignal: AbortSignal.abort(),
    });
    expect(r.total).toBe(0);
    expect(r.hits.length).toBe(0);
  });
});
