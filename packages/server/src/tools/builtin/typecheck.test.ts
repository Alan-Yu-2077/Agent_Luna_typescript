import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseTscOutput, typecheckTool } from './typecheck';
import { setSpawnerForTests, type Spawner } from '../shellCore';

let tmp: string;
const savedRoot = Bun.env['LUNA_WORKSPACE_ROOT'];
const ctx = () => ({ sessionId: 't', callId: 'c1', abortSignal: new AbortController().signal });

type Out = { ok: boolean; diagnostics: { file: string; line: number; message: string }[]; truncated: boolean };
async function run(input: unknown): Promise<{ kind: string; data?: Out }> {
  const events: { kind: string; data?: Out }[] = [];
  for await (const e of typecheckTool.execute(input as never, ctx())) events.push(e as { kind: string; data?: Out });
  return events.find((e) => e.kind === 'ok' || e.kind === 'err')!;
}

function spawner(stdout: string, exitCode: number): Spawner {
  return async () => ({ stdout, stderr: '', exitCode, timedOut: false });
}

beforeEach(() => {
  tmp = realpathSync(mkdtempSync(join(tmpdir(), 'luna-tsc-')));
  Bun.env['LUNA_WORKSPACE_ROOT'] = tmp;
});
afterEach(() => {
  setSpawnerForTests(null);
  if (savedRoot === undefined) delete Bun.env['LUNA_WORKSPACE_ROOT'];
  else Bun.env['LUNA_WORKSPACE_ROOT'] = savedRoot;
  rmSync(tmp, { recursive: true, force: true });
});

describe('parseTscOutput', () => {
  test('parses a known-bad run into {file,line,message}', () => {
    const out = [
      "src/foo.ts(12,5): error TS2322: Type 'string' is not assignable to type 'number'.",
      "src/bar.ts(3,1): error TS2304: Cannot find name 'x'.",
    ].join('\n');
    const { diagnostics } = parseTscOutput(out);
    expect(diagnostics.length).toBe(2);
    expect(diagnostics[0]).toEqual({ file: 'src/foo.ts', line: 12, column: 5, message: "Type 'string' is not assignable to type 'number'." });
    expect(diagnostics[1]!.file).toBe('src/bar.ts');
  });

  test('a clean run yields no diagnostics', () => {
    expect(parseTscOutput('').diagnostics.length).toBe(0);
    expect(parseTscOutput('some unrelated noise\n').diagnostics.length).toBe(0);
  });
});

describe('typecheck tool', () => {
  test('clean run → ok:true, empty diagnostics', async () => {
    setSpawnerForTests(spawner('', 0));
    const e = await run({});
    expect(e.kind).toBe('ok');
    expect(e.data!.ok).toBe(true);
    expect(e.data!.diagnostics.length).toBe(0);
  });

  test('failing run → ok:false with parsed diagnostics', async () => {
    setSpawnerForTests(spawner("src/x.ts(1,1): error TS1005: ';' expected.", 1));
    const e = await run({});
    expect(e.data!.ok).toBe(false);
    expect(e.data!.diagnostics[0]!.file).toBe('src/x.ts');
  });

  test('sensitive cwd is rejected', async () => {
    setSpawnerForTests(spawner('', 0));
    const e = await run({ cwd: '~/.ssh' }); // home secret dir → blocklist hit
    expect(e.kind).toBe('err');
  });

  test('is session-serial + surface-risk', () => {
    expect(typecheckTool.concurrency).toBe('session-serial');
    expect(typecheckTool.proactiveRisk).toBe('surface');
  });
});
