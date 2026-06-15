import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseBunTestOutput, runTestsTool } from './run_tests';
import { setSpawnerForTests, type Spawner } from '../shellCore';

let tmp: string;
const savedRoot = Bun.env['LUNA_WORKSPACE_ROOT'];
const ctx = () => ({ sessionId: 't', callId: 'c1', abortSignal: new AbortController().signal });

type Out = { ok: boolean; pass: number; fail: number; failures: string[]; truncated: boolean };
async function run(input: unknown): Promise<{ kind: string; data?: Out }> {
  const events: { kind: string; data?: Out }[] = [];
  for await (const e of runTestsTool.execute(input as never, ctx())) events.push(e as { kind: string; data?: Out });
  return events.find((e) => e.kind === 'ok' || e.kind === 'err')!;
}

function spawner(stderr: string, exitCode: number): Spawner {
  return async () => ({ stdout: '', stderr, exitCode, timedOut: false });
}

beforeEach(() => {
  tmp = realpathSync(mkdtempSync(join(tmpdir(), 'luna-runtests-')));
  Bun.env['LUNA_WORKSPACE_ROOT'] = tmp;
});
afterEach(() => {
  setSpawnerForTests(null);
  if (savedRoot === undefined) delete Bun.env['LUNA_WORKSPACE_ROOT'];
  else Bun.env['LUNA_WORKSPACE_ROOT'] = savedRoot;
  rmSync(tmp, { recursive: true, force: true });
});

const PASS_OUTPUT = ['', ' 12 pass', ' 0 fail', ' Ran 12 tests across 3 files.', ''].join('\n');
const FAIL_OUTPUT = [
  '(fail) my suite > does the thing [3.20ms]',
  '(fail) other > breaks [1.01ms]',
  ' 10 pass',
  ' 2 fail',
  '',
].join('\n');

describe('parseBunTestOutput', () => {
  test('parses a known-good run into {pass, fail:0, failures:[]}', () => {
    const r = parseBunTestOutput(PASS_OUTPUT);
    expect(r.pass).toBe(12);
    expect(r.fail).toBe(0);
    expect(r.failures.length).toBe(0);
  });

  test('parses a known-bad run into failures[]', () => {
    const r = parseBunTestOutput(FAIL_OUTPUT);
    expect(r.pass).toBe(10);
    expect(r.fail).toBe(2);
    expect(r.failures).toEqual(['my suite > does the thing', 'other > breaks']);
  });
});

describe('run_tests tool', () => {
  test('all pass → ok:true', async () => {
    setSpawnerForTests(spawner(PASS_OUTPUT, 0));
    const e = await run({});
    expect(e.data!.ok).toBe(true);
    expect(e.data!.pass).toBe(12);
  });

  test('failures → ok:false with failure names', async () => {
    setSpawnerForTests(spawner(FAIL_OUTPUT, 1));
    const e = await run({});
    expect(e.data!.ok).toBe(false);
    expect(e.data!.fail).toBe(2);
    expect(e.data!.failures.length).toBe(2);
  });

  test('sensitive cwd rejected', async () => {
    setSpawnerForTests(spawner(PASS_OUTPUT, 0));
    const e = await run({ cwd: '~/.aws' }); // home secret dir → blocklist hit
    expect(e.kind).toBe('err');
  });

  test('is session-serial + surface-risk', () => {
    expect(runTestsTool.concurrency).toBe('session-serial');
    expect(runTestsTool.proactiveRisk).toBe('surface');
  });
});
