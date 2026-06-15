import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listFilesTool } from './list_files';

let tmp: string;
const savedRoot = Bun.env['LUNA_WORKSPACE_ROOT'];

const ctx = () => ({
  sessionId: 'test',
  callId: 'c1',
  abortSignal: new AbortController().signal,
});

type ListOut = { root: string; entries: { path: string; type: 'file' | 'dir' }[]; truncated: boolean };
async function run(input: unknown): Promise<{ kind: string; data?: ListOut; code?: string }> {
  const events: unknown[] = [];
  for await (const e of listFilesTool.execute(input as never, ctx())) events.push(e);
  return events[0] as { kind: string; data?: ListOut };
}

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'luna-list-'));
  Bun.env['LUNA_WORKSPACE_ROOT'] = tmp;
  mkdirSync(join(tmp, 'src'), { recursive: true });
  mkdirSync(join(tmp, 'node_modules', 'pkg'), { recursive: true });
  mkdirSync(join(tmp, '.git'), { recursive: true });
  writeFileSync(join(tmp, 'src', 'a.ts'), 'export const a = 1;');
  writeFileSync(join(tmp, 'src', 'b.ts'), 'export const b = 2;');
  writeFileSync(join(tmp, 'src', 'c.js'), 'module.exports = 3;');
  writeFileSync(join(tmp, 'README.md'), '# hi');
  writeFileSync(join(tmp, 'node_modules', 'pkg', 'index.js'), 'x');
  writeFileSync(join(tmp, '.hidden'), 'secret-ish');
});

afterEach(() => {
  if (savedRoot === undefined) delete Bun.env['LUNA_WORKSPACE_ROOT'];
  else Bun.env['LUNA_WORKSPACE_ROOT'] = savedRoot;
  rmSync(tmp, { recursive: true, force: true });
});

describe('list_files', () => {
  test('lists top-level entries, hides dotfiles by default', async () => {
    const e = await run({});
    expect(e.kind).toBe('ok');
    const paths = e.data!.entries.map((x) => x.path);
    expect(paths).toContain('src');
    expect(paths).toContain('README.md');
    expect(paths).not.toContain('.hidden');
  });

  test('ignore-set honored: node_modules and .git excluded when recursive', async () => {
    const e = await run({ recursive: true });
    const paths = e.data!.entries.map((x) => x.path);
    expect(paths.some((p) => p.includes('node_modules'))).toBe(false);
    expect(paths.some((p) => p.includes('.git'))).toBe(false);
    expect(paths).toContain(join('src', 'a.ts'));
  });

  test('glob filter restricts to matching files', async () => {
    const e = await run({ recursive: true, glob: '**/*.ts' });
    const paths = e.data!.entries.map((x) => x.path);
    expect(paths).toContain(join('src', 'a.ts'));
    expect(paths).toContain(join('src', 'b.ts'));
    expect(paths.some((p) => p.endsWith('.js'))).toBe(false);
    expect(paths.some((p) => p.endsWith('.md'))).toBe(false);
  });

  test('include_hidden surfaces dotfiles', async () => {
    const e = await run({ include_hidden: true });
    const paths = e.data!.entries.map((x) => x.path);
    expect(paths).toContain('.hidden');
  });

  test('max_entries truncation sets the flag', async () => {
    const e = await run({ recursive: true, max_entries: 2 });
    expect(e.data!.entries.length).toBe(2);
    expect(e.data!.truncated).toBe(true);
  });

  test('a secret directory is rejected', async () => {
    const e = await run({ path: '.env' });
    expect(e.kind).toBe('err');
  });

  test('summarize reports file/dir counts', () => {
    expect(
      listFilesTool.summarize({
        root: '/x',
        entries: [
          { path: 'a', type: 'file' },
          { path: 'd', type: 'dir' },
        ],
        truncated: false,
      }),
    ).toContain('2 entries');
  });
});
