import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileTool } from './write_file';
import { contentHash } from '../workspace';
import { resetReadTracking, wasRead } from '../readTracking';
import { resolveInWorkspace } from '../workspace';

let tmp: string;
const savedRoot = Bun.env['LUNA_WORKSPACE_ROOT'];
const SESSION = 'writefile-test';

const ctx = () => ({ sessionId: SESSION, callId: 'c1', abortSignal: new AbortController().signal });

type WriteOut = {
  path: string;
  created: boolean;
  bytes_written: number;
  line_count: number;
  diff: string;
  previous_hash: string | null;
  content_hash: string;
  lint: { message: string }[];
};
type Result = { kind: string; data?: WriteOut; code?: string; message?: string; recoverable?: boolean };

async function run(input: unknown): Promise<Result> {
  const events: unknown[] = [];
  for await (const e of writeFileTool.execute(input as never, ctx())) events.push(e);
  return events[0] as Result;
}

function read(name: string): string {
  return readFileSync(join(tmp, name), 'utf8');
}

beforeEach(() => {
  tmp = realpathSync(mkdtempSync(join(tmpdir(), 'luna-write-')));
  Bun.env['LUNA_WORKSPACE_ROOT'] = tmp;
  resetReadTracking();
});

afterEach(() => {
  if (savedRoot === undefined) delete Bun.env['LUNA_WORKSPACE_ROOT'];
  else Bun.env['LUNA_WORKSPACE_ROOT'] = savedRoot;
  resetReadTracking();
  rmSync(tmp, { recursive: true, force: true });
});

describe('write_file — create', () => {
  test('creates a new file, reports created:true + content_hash', async () => {
    const e = await run({ path: 'new.ts', content: 'export const x = 1;\n' });
    expect(e.kind).toBe('ok');
    expect(e.data!.created).toBe(true);
    expect(e.data!.previous_hash).toBeNull();
    expect(read('new.ts')).toBe('export const x = 1;\n');
    expect(e.data!.content_hash).toBe(contentHash('export const x = 1;\n'));
    expect(e.data!.line_count).toBe(2); // trailing newline → 2 split parts
  });

  test('create_dirs makes missing parent directories', async () => {
    const e = await run({ path: 'a/b/c/deep.ts', content: 'const z = 9;\n', create_dirs: true });
    expect(e.kind).toBe('ok');
    expect(existsSync(join(tmp, 'a/b/c/deep.ts'))).toBe(true);
  });

  test('without create_dirs a missing parent is a recoverable error', async () => {
    const e = await run({ path: 'nope/deep.ts', content: 'x', create_dirs: false });
    expect(e.kind).toBe('err');
    expect(e.recoverable).toBe(true);
    expect(e.message).toContain('parent directory');
  });

  test('a freshly-written file is marked read (a follow-up edit is allowed)', async () => {
    await run({ path: 'fresh.ts', content: 'const a = 1;\n' });
    const gate = resolveInWorkspace('fresh.ts', 'write');
    expect(gate.ok).toBe(true);
    if (gate.ok) expect(wasRead(SESSION, gate.resolved)).toBe(true);
  });
});

describe('write_file — overwrite protection', () => {
  test('refuses to clobber an existing file without overwrite', async () => {
    writeFileSync(join(tmp, 'exists.ts'), 'OLD\n');
    const e = await run({ path: 'exists.ts', content: 'NEW\n' });
    expect(e.kind).toBe('err');
    expect(e.recoverable).toBe(true);
    expect(e.message).toContain('already exists');
    expect(read('exists.ts')).toBe('OLD\n'); // untouched
  });

  test('overwrite:true replaces and reports created:false + previous_hash', async () => {
    writeFileSync(join(tmp, 'exists.ts'), 'OLD\n');
    const e = await run({ path: 'exists.ts', content: 'NEW\n', overwrite: true });
    expect(e.kind).toBe('ok');
    expect(e.data!.created).toBe(false);
    expect(e.data!.previous_hash).toBe(contentHash('OLD\n'));
    expect(read('exists.ts')).toBe('NEW\n');
    expect(e.data!.diff).toContain('-OLD');
    expect(e.data!.diff).toContain('+NEW');
  });

  test('stale expected_hash on overwrite is rejected', async () => {
    writeFileSync(join(tmp, 'exists.ts'), 'OLD\n');
    const e = await run({ path: 'exists.ts', content: 'NEW\n', overwrite: true, expected_hash: 'wrong' });
    expect(e.kind).toBe('err');
    expect(e.message).toContain('stale_file');
    expect(read('exists.ts')).toBe('OLD\n');
  });
});

describe('write_file — lint + jail', () => {
  test('a syntactically broken new TS file returns lint diagnostics', async () => {
    const e = await run({ path: 'broken.ts', content: 'const x = ;\n' });
    expect(e.kind).toBe('ok');
    expect(e.data!.lint.length).toBeGreaterThan(0);
  });

  test('cannot create a *.test.ts (evaluator firewall)', async () => {
    const e = await run({ path: 'evil.test.ts', content: 'const x = 1;\n' });
    expect(e.kind).toBe('err');
    expect(e.recoverable).toBe(false);
    expect(e.message).toContain('evaluator firewall');
    expect(existsSync(join(tmp, 'evil.test.ts'))).toBe(false);
  });

  test('cannot write a secret (.env)', async () => {
    const e = await run({ path: '.env', content: 'SECRET=2\n' });
    expect(e.kind).toBe('err');
    expect(e.recoverable).toBe(false);
  });
});
