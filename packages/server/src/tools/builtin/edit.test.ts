import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { editTool } from './edit';
import { contentHash, resolveInWorkspace } from '../workspace';
import { markRead, resetReadTracking } from '../readTracking';

let tmp: string;
const savedRoot = Bun.env['LUNA_WORKSPACE_ROOT'];
const SESSION = 'edit-test';

const ctx = () => ({ sessionId: SESSION, callId: 'c1', abortSignal: new AbortController().signal });

type EditOut = {
  path: string;
  replacements: number;
  fuzzed: boolean;
  diff: string;
  previous_hash: string;
  content_hash: string;
  lint: { message: string }[];
};
type Result = { kind: string; data?: EditOut; code?: string; message?: string; recoverable?: boolean };

async function run(input: unknown): Promise<Result> {
  const events: unknown[] = [];
  for await (const e of editTool.execute(input as never, ctx())) events.push(e);
  return events[0] as Result;
}

// Mark a file read this session (the read-before-edit gate), keyed by the canonical path.
function markFileRead(name: string): void {
  const gate = resolveInWorkspace(name, 'write');
  if (gate.ok) markRead(SESSION, gate.resolved);
}

function write(name: string, text: string): void {
  writeFileSync(join(tmp, name), text);
}
function read(name: string): string {
  return readFileSync(join(tmp, name), 'utf8');
}

beforeEach(() => {
  tmp = realpathSync(mkdtempSync(join(tmpdir(), 'luna-edit-')));
  Bun.env['LUNA_WORKSPACE_ROOT'] = tmp;
  resetReadTracking();
});

afterEach(() => {
  if (savedRoot === undefined) delete Bun.env['LUNA_WORKSPACE_ROOT'];
  else Bun.env['LUNA_WORKSPACE_ROOT'] = savedRoot;
  resetReadTracking();
  rmSync(tmp, { recursive: true, force: true });
});

describe('edit — happy path', () => {
  test('exact single replace writes the file + returns diff and new hash', async () => {
    write('a.ts', 'const x = 1;\nconst y = 2;\n');
    markFileRead('a.ts');
    const e = await run({ path: 'a.ts', old_string: 'const x = 1;', new_string: 'const x = 42;' });
    expect(e.kind).toBe('ok');
    expect(e.data!.replacements).toBe(1);
    expect(e.data!.fuzzed).toBe(false);
    expect(read('a.ts')).toBe('const x = 42;\nconst y = 2;\n');
    expect(e.data!.content_hash).toBe(contentHash(read('a.ts')));
    expect(e.data!.diff).toContain('-const x = 1;');
    expect(e.data!.diff).toContain('+const x = 42;');
  });

  test('new_string may be empty (deletion)', async () => {
    write('a.ts', 'keep\nremove me\nkeep\n');
    markFileRead('a.ts');
    const e = await run({ path: 'a.ts', old_string: 'remove me\n', new_string: '' });
    expect(e.kind).toBe('ok');
    expect(read('a.ts')).toBe('keep\nkeep\n');
  });
});

describe('edit — uniqueness', () => {
  test('>1 match without replace_all is a recoverable error and writes nothing', async () => {
    write('a.ts', 'foo\nfoo\nbar\n');
    markFileRead('a.ts');
    const e = await run({ path: 'a.ts', old_string: 'foo', new_string: 'baz' });
    expect(e.kind).toBe('err');
    expect(e.recoverable).toBe(true);
    expect(e.message).toContain('2 times');
    expect(read('a.ts')).toBe('foo\nfoo\nbar\n'); // untouched
  });

  test('replace_all replaces every occurrence', async () => {
    write('a.ts', 'foo\nfoo\nbar\n');
    markFileRead('a.ts');
    const e = await run({ path: 'a.ts', old_string: 'foo', new_string: 'baz', replace_all: true });
    expect(e.kind).toBe('ok');
    expect(e.data!.replacements).toBe(2);
    expect(read('a.ts')).toBe('baz\nbaz\nbar\n');
  });
});

describe('edit — read-before-edit', () => {
  test('an unread file is rejected (recoverable) and not modified', async () => {
    write('a.ts', 'const x = 1;\n');
    // deliberately NOT marked read
    const e = await run({ path: 'a.ts', old_string: 'const x = 1;', new_string: 'const x = 2;' });
    expect(e.kind).toBe('err');
    expect(e.recoverable).toBe(true);
    expect(e.message).toContain('read the file first');
    expect(read('a.ts')).toBe('const x = 1;\n');
  });
});

describe('edit — fuzzy fallback', () => {
  test('whitespace-tolerant match succeeds and reports fuzzed:true', async () => {
    // file indents the block; the model's old_string does NOT reproduce that
    // indentation, so it is not an exact substring — only the stripped-line pass
    // matches → fuzzed:true. (The replacement carries the model's spelling.)
    write('a.ts', 'function f() {\n      return 1;\n}\n');
    markFileRead('a.ts');
    // old_string carries DIFFERENT indentation than the file → not a verbatim
    // substring; only the stripped-line pass matches.
    const e = await run({ path: 'a.ts', old_string: '  return 1;\n  }', new_string: 'return 2;\n}' });
    expect(e.kind).toBe('ok');
    expect(e.data!.fuzzed).toBe(true);
    // the matched window (with the file's real indentation) is replaced
    expect(read('a.ts')).toContain('return 2;');
    expect(read('a.ts')).not.toContain('return 1;');
  });

  test('a genuinely-absent old_string fails with a closest-match hint', async () => {
    write('a.ts', 'alpha\nbeta\ngamma\n');
    markFileRead('a.ts');
    const e = await run({ path: 'a.ts', old_string: 'beta\nXXXXX\n', new_string: 'z' });
    expect(e.kind).toBe('err');
    expect(e.recoverable).toBe(true);
    expect(e.message).toContain('not found');
  });
});

describe('edit — CRLF preserved', () => {
  test('a CRLF file stays CRLF after an edit', async () => {
    write('crlf.ts', 'const a = 1;\r\nconst b = 2;\r\n');
    markFileRead('crlf.ts');
    const e = await run({ path: 'crlf.ts', old_string: 'const b = 2;', new_string: 'const b = 9;' });
    expect(e.kind).toBe('ok');
    expect(read('crlf.ts')).toBe('const a = 1;\r\nconst b = 9;\r\n');
  });
});

describe('edit — optimistic concurrency', () => {
  test('a mismatched expected_hash → stale_file (recoverable), no write', async () => {
    write('a.ts', 'const x = 1;\n');
    markFileRead('a.ts');
    const e = await run({
      path: 'a.ts',
      old_string: 'const x = 1;',
      new_string: 'const x = 2;',
      expected_hash: 'deadbeef',
    });
    expect(e.kind).toBe('err');
    expect(e.message).toContain('stale_file');
    expect(read('a.ts')).toBe('const x = 1;\n');
  });

  test('a matching expected_hash is accepted', async () => {
    write('a.ts', 'const x = 1;\n');
    markFileRead('a.ts');
    const e = await run({
      path: 'a.ts',
      old_string: 'const x = 1;',
      new_string: 'const x = 2;',
      expected_hash: contentHash('const x = 1;\n'),
    });
    expect(e.kind).toBe('ok');
  });
});

describe('edit — lint-on-write', () => {
  test('a syntactically broken TS edit returns lint diagnostics', async () => {
    write('a.ts', 'const x = 1;\n');
    markFileRead('a.ts');
    const e = await run({ path: 'a.ts', old_string: 'const x = 1;', new_string: 'const x = ;' });
    expect(e.kind).toBe('ok'); // surfaced, not auto-reverted (v1)
    expect(e.data!.lint.length).toBeGreaterThan(0);
  });

  test('a clean TS edit returns no diagnostics', async () => {
    write('a.ts', 'const x = 1;\n');
    markFileRead('a.ts');
    const e = await run({ path: 'a.ts', old_string: 'const x = 1;', new_string: 'const x = 2;' });
    expect(e.data!.lint.length).toBe(0);
  });
});

describe('edit — jail', () => {
  test('an evaluator-firewall path (*.test.ts) is rejected for write (non-recoverable)', async () => {
    write('foo.test.ts', 'const x = 1;\n');
    markFileRead('foo.test.ts'); // read tracking is irrelevant — the jail fires first
    const e = await run({ path: 'foo.test.ts', old_string: 'const x = 1;', new_string: 'const x = 2;' });
    expect(e.kind).toBe('err');
    expect(e.recoverable).toBe(false);
    expect(e.message).toContain('evaluator firewall');
    expect(read('foo.test.ts')).toBe('const x = 1;\n');
  });

  test('a secret path (.env) is rejected for write', async () => {
    write('.env', 'SECRET=1\n');
    const e = await run({ path: '.env', old_string: 'SECRET=1', new_string: 'SECRET=2' });
    expect(e.kind).toBe('err');
    expect(e.recoverable).toBe(false);
  });
});
