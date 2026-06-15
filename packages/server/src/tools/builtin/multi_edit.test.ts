import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { multiEditTool } from './multi_edit';
import { contentHash, resolveInWorkspace } from '../workspace';
import { markRead, resetReadTracking } from '../readTracking';

let tmp: string;
const savedRoot = Bun.env['LUNA_WORKSPACE_ROOT'];
const SESSION = 'multiedit-test';

const ctx = () => ({ sessionId: SESSION, callId: 'c1', abortSignal: new AbortController().signal });

type MultiOut = {
  path: string;
  edits_applied: number;
  replacements: number;
  fuzzed: boolean;
  diff: string;
  content_hash: string;
  lint: { message: string }[];
};
type Result = { kind: string; data?: MultiOut; code?: string; message?: string; recoverable?: boolean };

async function run(input: unknown): Promise<Result> {
  const events: unknown[] = [];
  for await (const e of multiEditTool.execute(input as never, ctx())) events.push(e);
  return events[0] as Result;
}

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
  tmp = realpathSync(mkdtempSync(join(tmpdir(), 'luna-medit-')));
  Bun.env['LUNA_WORKSPACE_ROOT'] = tmp;
  resetReadTracking();
});

afterEach(() => {
  if (savedRoot === undefined) delete Bun.env['LUNA_WORKSPACE_ROOT'];
  else Bun.env['LUNA_WORKSPACE_ROOT'] = savedRoot;
  resetReadTracking();
  rmSync(tmp, { recursive: true, force: true });
});

describe('multi_edit — atomic apply', () => {
  test('a sequence of hunks applies in order', async () => {
    write('a.ts', 'const a = 1;\nconst b = 2;\nconst c = 3;\n');
    markFileRead('a.ts');
    const e = await run({
      path: 'a.ts',
      edits: [
        { old_string: 'const a = 1;', new_string: 'const a = 10;' },
        { old_string: 'const c = 3;', new_string: 'const c = 30;' },
      ],
    });
    expect(e.kind).toBe('ok');
    expect(e.data!.edits_applied).toBe(2);
    expect(read('a.ts')).toBe('const a = 10;\nconst b = 2;\nconst c = 30;\n');
  });

  test('a later hunk can target text the earlier hunk produced', async () => {
    write('a.ts', 'one\n');
    markFileRead('a.ts');
    const e = await run({
      path: 'a.ts',
      edits: [
        { old_string: 'one', new_string: 'two' },
        { old_string: 'two', new_string: 'three' },
      ],
    });
    expect(e.kind).toBe('ok');
    expect(read('a.ts')).toBe('three\n');
  });

  test('a failing 2nd hunk leaves the file UNTOUCHED and reports the index', async () => {
    const original = 'const a = 1;\nconst b = 2;\n';
    write('a.ts', original);
    markFileRead('a.ts');
    const e = await run({
      path: 'a.ts',
      edits: [
        { old_string: 'const a = 1;', new_string: 'const a = 10;' }, // would succeed
        { old_string: 'DOES NOT EXIST', new_string: 'x' }, // fails
      ],
    });
    expect(e.kind).toBe('err');
    expect(e.recoverable).toBe(true);
    expect(e.message).toContain('edit[1]');
    // atomic: nothing written despite the first hunk being applicable
    expect(read('a.ts')).toBe(original);
  });

  test('an ambiguous hunk (>1 match, no replace_all) aborts the whole apply', async () => {
    const original = 'dup\ndup\nkeep\n';
    write('a.ts', original);
    markFileRead('a.ts');
    const e = await run({
      path: 'a.ts',
      edits: [
        { old_string: 'keep', new_string: 'KEEP' },
        { old_string: 'dup', new_string: 'X' }, // 2 matches, no replace_all
      ],
    });
    expect(e.kind).toBe('err');
    expect(e.message).toContain('edit[1]');
    expect(read('a.ts')).toBe(original);
  });
});

describe('multi_edit — gates shared with edit', () => {
  test('read-before-edit applies', async () => {
    write('a.ts', 'x\n');
    const e = await run({ path: 'a.ts', edits: [{ old_string: 'x', new_string: 'y' }] });
    expect(e.kind).toBe('err');
    expect(e.message).toContain('read the file first');
  });

  test('stale expected_hash aborts', async () => {
    write('a.ts', 'x\n');
    markFileRead('a.ts');
    const e = await run({
      path: 'a.ts',
      edits: [{ old_string: 'x', new_string: 'y' }],
      expected_hash: 'nope',
    });
    expect(e.kind).toBe('err');
    expect(e.message).toContain('stale_file');
    expect(read('a.ts')).toBe('x\n');
  });

  test('content_hash + matching expected_hash accepted', async () => {
    write('a.ts', 'x\n');
    markFileRead('a.ts');
    const e = await run({
      path: 'a.ts',
      edits: [{ old_string: 'x', new_string: 'y' }],
      expected_hash: contentHash('x\n'),
    });
    expect(e.kind).toBe('ok');
    expect(e.data!.content_hash).toBe(contentHash('y\n'));
  });

  test('a *.test.ts target is jailed (write blocked)', async () => {
    write('z.test.ts', 'const a = 1;\n');
    markFileRead('z.test.ts');
    const e = await run({ path: 'z.test.ts', edits: [{ old_string: 'const a = 1;', new_string: 'const a = 2;' }] });
    expect(e.kind).toBe('err');
    expect(e.recoverable).toBe(false);
    expect(e.message).toContain('evaluator firewall');
  });
});
