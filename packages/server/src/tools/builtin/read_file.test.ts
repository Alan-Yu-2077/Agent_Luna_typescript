import { describe, expect, test } from 'bun:test';
import { readFileTool } from './read_file';

const ctx = () => ({
  sessionId: 'test',
  callId: 'c1',
  abortSignal: new AbortController().signal,
});

async function collect(input: { path: string }): Promise<unknown[]> {
  const out: unknown[] = [];
  for await (const e of readFileTool.execute(input, ctx())) out.push(e);
  return out;
}

describe('read_file', () => {
  test('reads an existing file with line count', async () => {
    const events = await collect({ path: 'package.json' });
    expect(events.length).toBe(1);
    const e = events[0] as {
      kind: string;
      data: { content: string; lines: number; truncated: boolean };
    };
    expect(e.kind).toBe('ok');
    expect(e.data.content.length).toBeGreaterThan(0);
    expect(e.data.lines).toBeGreaterThan(0);
    expect(e.data.truncated).toBe(false);
  });

  test('non-existent file yields recoverable execution_exception', async () => {
    const events = await collect({ path: '/nonexistent/path/that/does/not/exist.txt' });
    expect(events.length).toBe(1);
    const e = events[0] as {
      kind: string;
      code: string;
      message: string;
      recoverable: boolean;
    };
    expect(e.kind).toBe('err');
    expect(e.code).toBe('execution_exception');
    expect(e.recoverable).toBe(true);
  });
});
