import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileTool } from './read_file';
import { contentHash } from '../workspace';

let tmp: string;
const savedRoot = Bun.env['LUNA_WORKSPACE_ROOT'];

const ctx = () => ({
  sessionId: 'test',
  callId: 'c1',
  abortSignal: new AbortController().signal,
});

type ReadOut = {
  content: string;
  start_line: number;
  end_line: number;
  total_lines: number;
  truncated: boolean;
  content_hash: string;
};

async function run(input: unknown): Promise<{ kind: string; data?: ReadOut; code?: string; recoverable?: boolean }> {
  const events: unknown[] = [];
  for await (const e of readFileTool.execute(input as never, ctx())) events.push(e);
  return events[0] as { kind: string; data?: ReadOut };
}

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'luna-read-'));
  Bun.env['LUNA_WORKSPACE_ROOT'] = tmp;
});

afterEach(() => {
  if (savedRoot === undefined) delete Bun.env['LUNA_WORKSPACE_ROOT'];
  else Bun.env['LUNA_WORKSPACE_ROOT'] = savedRoot;
  rmSync(tmp, { recursive: true, force: true });
});

function writeLines(name: string, count: number): string {
  const text = Array.from({ length: count }, (_, i) => `line ${i + 1}`).join('\n');
  writeFileSync(join(tmp, name), text);
  return text;
}

describe('read_file windowed read', () => {
  test('default window returns the right start/end/total and numbered content', async () => {
    writeLines('big.txt', 50);
    const e = await run({ path: 'big.txt' });
    expect(e.kind).toBe('ok');
    expect(e.data!.start_line).toBe(1);
    expect(e.data!.end_line).toBe(50);
    expect(e.data!.total_lines).toBe(50);
    expect(e.data!.truncated).toBe(false);
    expect(e.data!.content).toContain('1\tline 1');
    expect(e.data!.content).toContain('50\tline 50');
  });

  test('offset + limit page through the file', async () => {
    writeLines('big.txt', 100);
    const e = await run({ path: 'big.txt', offset: 10, limit: 5 });
    expect(e.data!.start_line).toBe(10);
    expect(e.data!.end_line).toBe(14);
    expect(e.data!.total_lines).toBe(100);
    expect(e.data!.truncated).toBe(true);
    expect(e.data!.content).toContain('10\tline 10');
    expect(e.data!.content).toContain('14\tline 14');
    expect(e.data!.content).not.toContain('line 15');
  });

  test('truncated set when default window is shorter than the file', async () => {
    writeLines('huge.txt', 1200);
    const e = await run({ path: 'huge.txt' }); // default limit 800
    expect(e.data!.end_line).toBe(800);
    expect(e.data!.truncated).toBe(true);
    expect(e.data!.total_lines).toBe(1200);
  });

  test('limit is hard-capped at 2000', async () => {
    const e = await run({ path: 'x', limit: 9999 });
    // schema rejects > 2000 → validation never reaches execute; assert via parse
    expect(readFileTool.input.safeParse({ path: 'x', limit: 9999 }).success).toBe(false);
    expect(readFileTool.input.safeParse({ path: 'x', limit: 2000 }).success).toBe(true);
    void e;
  });

  test('content_hash is stable and matches sha256 of the raw file', async () => {
    const text = writeLines('hashme.txt', 5);
    const e = await run({ path: 'hashme.txt' });
    expect(e.data!.content_hash).toBe(contentHash(text));
  });

  test('offset past EOF returns an empty window, not an error', async () => {
    writeLines('short.txt', 3);
    const e = await run({ path: 'short.txt', offset: 99 });
    expect(e.kind).toBe('ok');
    expect(e.data!.content).toBe('');
    expect(e.data!.total_lines).toBe(3);
  });

  test('non-existent file yields recoverable execution_exception', async () => {
    const e = await run({ path: 'nope.txt' });
    expect(e.kind).toBe('err');
    expect(e.code).toBe('execution_exception');
    expect(e.recoverable).toBe(true);
  });

  test('a secret path is rejected (non-recoverable) even for read', async () => {
    writeFileSync(join(tmp, '.env'), 'SECRET=1');
    const e = await run({ path: '.env' });
    expect(e.kind).toBe('err');
    expect(e.recoverable).toBe(false);
  });
});
