import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lintTool, parsePrettierOutput } from './lint';
import { setSpawnerForTests, type Spawner } from '../shellCore';

let tmp: string;
const savedRoot = Bun.env['LUNA_WORKSPACE_ROOT'];
const ctx = () => ({ sessionId: 't', callId: 'c1', abortSignal: new AbortController().signal });

type Out = { ok: boolean; issues: string[]; truncated: boolean };
async function run(input: unknown): Promise<{ kind: string; data?: Out }> {
  const events: { kind: string; data?: Out }[] = [];
  for await (const e of lintTool.execute(input as never, ctx())) events.push(e as { kind: string; data?: Out });
  return events.find((e) => e.kind === 'ok' || e.kind === 'err')!;
}

function spawner(stdout: string, exitCode: number): Spawner {
  return async () => ({ stdout, stderr: '', exitCode, timedOut: false });
}

beforeEach(() => {
  tmp = realpathSync(mkdtempSync(join(tmpdir(), 'luna-lint-')));
  Bun.env['LUNA_WORKSPACE_ROOT'] = tmp;
});
afterEach(() => {
  setSpawnerForTests(null);
  if (savedRoot === undefined) delete Bun.env['LUNA_WORKSPACE_ROOT'];
  else Bun.env['LUNA_WORKSPACE_ROOT'] = savedRoot;
  rmSync(tmp, { recursive: true, force: true });
});

const CLEAN = 'Checking formatting...\nAll matched files use Prettier code style!\n';
const DIRTY = [
  'Checking formatting...',
  '[warn] src/a.ts',
  '[warn] src/b.tsx',
  '[warn] Code style issues found in 2 files. Run Prettier to fix.',
  '',
].join('\n');

describe('parsePrettierOutput', () => {
  test('a clean run has no issues', () => {
    expect(parsePrettierOutput(CLEAN).issues.length).toBe(0);
  });

  test('a dirty run lists the unformatted files (footer excluded)', () => {
    const { issues } = parsePrettierOutput(DIRTY);
    expect(issues).toEqual(['src/a.ts', 'src/b.tsx']);
  });
});

describe('lint tool', () => {
  test('clean → ok:true', async () => {
    setSpawnerForTests(spawner(CLEAN, 0));
    const e = await run({});
    expect(e.data!.ok).toBe(true);
    expect(e.data!.issues.length).toBe(0);
  });

  test('dirty → ok:false with the file list', async () => {
    setSpawnerForTests(spawner(DIRTY, 1));
    const e = await run({});
    expect(e.data!.ok).toBe(false);
    expect(e.data!.issues).toEqual(['src/a.ts', 'src/b.tsx']);
  });

  test('sensitive cwd rejected', async () => {
    setSpawnerForTests(spawner(CLEAN, 0));
    const e = await run({ cwd: '~/.gnupg' }); // home secret dir → blocklist hit
    expect(e.kind).toBe('err');
  });

  test('is session-serial + surface-risk', () => {
    expect(lintTool.concurrency).toBe('session-serial');
    expect(lintTool.proactiveRisk).toBe('surface');
  });
});
