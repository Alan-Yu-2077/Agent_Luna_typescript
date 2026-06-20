import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { shellTool } from './shell';
import { setSpawnerForTests, type SpawnRequest, type Spawner } from '../shellCore';
import { proactiveRiskOf } from '../../proactive/safetyGate';

let tmp: string;
const savedRoot = Bun.env['LUNA_WORKSPACE_ROOT'];

const ctx = () => ({ sessionId: 'shell-test', callId: 'c1', abortSignal: new AbortController().signal });

type ShellOut = { stdout: string; stderr: string; exit_code: number; timed_out: boolean };
type Result = { kind: string; data?: ShellOut; code?: string; message?: string; recoverable?: boolean };

// Drain the generator; return the FINAL (ok/err) event, skipping progress.
async function run(input: unknown): Promise<Result> {
  const events: Result[] = [];
  for await (const e of shellTool.execute(input as never, ctx())) events.push(e as Result);
  return events.find((e) => e.kind === 'ok' || e.kind === 'err') as Result;
}

// A fake spawner that records what it was asked to run and returns a canned
// result — so NO real (let alone destructive) command ever runs.
let lastReq: SpawnRequest | null = null;
function fakeSpawner(result: { stdout?: string; stderr?: string; exitCode?: number; timedOut?: boolean }): Spawner {
  return async (req) => {
    lastReq = req;
    return {
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
      exitCode: result.exitCode ?? 0,
      timedOut: result.timedOut ?? false,
    };
  };
}

beforeEach(() => {
  tmp = realpathSync(mkdtempSync(join(tmpdir(), 'luna-shell-')));
  Bun.env['LUNA_WORKSPACE_ROOT'] = tmp;
  lastReq = null;
});

afterEach(() => {
  setSpawnerForTests(null);
  if (savedRoot === undefined) delete Bun.env['LUNA_WORKSPACE_ROOT'];
  else Bun.env['LUNA_WORKSPACE_ROOT'] = savedRoot;
  rmSync(tmp, { recursive: true, force: true });
});

describe('shell — safe path', () => {
  test('a safe command returns stdout + exit 0', async () => {
    setSpawnerForTests(fakeSpawner({ stdout: 'hello\n', exitCode: 0 }));
    const e = await run({ command: 'echo hello' });
    expect(e.kind).toBe('ok');
    expect(e.data!.stdout).toBe('hello\n');
    expect(e.data!.exit_code).toBe(0);
    expect(e.data!.timed_out).toBe(false);
    // ran in the workspace root by default
    expect(lastReq?.cwd).toBe(tmp);
  });

  test('timed_out is surfaced from the spawner', async () => {
    setSpawnerForTests(fakeSpawner({ stdout: '', exitCode: 124, timedOut: true }));
    const e = await run({ command: 'sleep 999' });
    expect(e.kind).toBe('ok');
    expect(e.data!.timed_out).toBe(true);
  });

  test('per-call timeout_ms is clamped and forwarded to the spawner', async () => {
    setSpawnerForTests(fakeSpawner({ stdout: 'ok' }));
    await run({ command: 'echo ok', timeout_ms: 10_000_000 }); // > hard max
    expect(lastReq?.timeoutMs).toBe(1_800_000); // SHELL_MAX_TIMEOUT_MS
  });
});

describe('shell — deny-regex + interactive block (no spawn)', () => {
  test('rm -rf is refused before any spawn', async () => {
    setSpawnerForTests(fakeSpawner({ stdout: 'should never run' }));
    const e = await run({ command: 'rm -rf /' });
    expect(e.kind).toBe('err');
    expect(e.recoverable).toBe(true);
    expect(lastReq).toBeNull(); // spawner never invoked
  });

  test('sudo is refused', async () => {
    setSpawnerForTests(fakeSpawner({ stdout: 'x' }));
    const e = await run({ command: 'sudo rm file' });
    expect(e.kind).toBe('err');
    expect(lastReq).toBeNull();
  });

  test('an interactive command is refused', async () => {
    setSpawnerForTests(fakeSpawner({ stdout: 'x' }));
    const e = await run({ command: 'vim notes.txt' });
    expect(e.kind).toBe('err');
    expect(e.message).toContain('interactive');
    expect(lastReq).toBeNull();
  });
});

describe('shell — sandbox / cwd', () => {
  test('a sensitive cwd is rejected by the blocklist (not just missing)', async () => {
    setSpawnerForTests(fakeSpawner({ stdout: 'x' }));
    const e = await run({ command: 'echo hi', cwd: '~/.ssh' }); // home secret dir
    expect(e.kind).toBe('err');
    expect(e.recoverable).toBe(false); // blocklist hit, not a recoverable "missing dir"
    expect(lastReq).toBeNull();
  });

  test('a sensitive path NAMED IN THE COMMAND is rejected', async () => {
    setSpawnerForTests(fakeSpawner({ stdout: 'x' }));
    const e = await run({ command: 'cat ~/.aws/credentials' });
    expect(e.kind).toBe('err');
    expect(lastReq).toBeNull();
  });

  test('reading a .env in the command text is rejected (secret pattern)', async () => {
    setSpawnerForTests(fakeSpawner({ stdout: 'x' }));
    const e = await run({ command: `cat ${join(tmp, '.env')}` });
    expect(e.kind).toBe('err');
    expect(lastReq).toBeNull();
  });

  // v0.20.1 — env-var indirection cannot launder a secret directory: the captured
  // token (`/.aws/credentials`) resolves outside the real $HOME, so only the
  // tail-segment check catches these.
  for (const command of [
    'cat $HOME/.aws/credentials',
    'cat ${HOME}/.ssh/id_ed25519',
    'cat $HOME/.config/gcloud/credentials.db',
    'cat $HOME/.docker/config.json',
    'cat $HOME/.gnupg/secring.gpg',
  ]) {
    test(`env-indirection secret read is rejected: ${command}`, async () => {
      setSpawnerForTests(fakeSpawner({ stdout: 'x' }));
      const e = await run({ command });
      expect(e.kind).toBe('err');
      expect(lastReq).toBeNull();
    });
  }

  test('a non-secret path with a secret-like substring is NOT over-blocked', async () => {
    setSpawnerForTests(fakeSpawner({ stdout: 'x' }));
    const e = await run({ command: 'cat /tmp/.aws-notes/readme.txt' }); // .aws-notes ≠ .aws
    expect(e.kind).toBe('ok');
  });

  test('a non-existent cwd (not a directory) is refused', async () => {
    setSpawnerForTests(fakeSpawner({ stdout: 'x' }));
    const e = await run({ command: 'echo hi', cwd: join(tmp, 'does-not-exist') });
    expect(e.kind).toBe('err');
    expect(lastReq).toBeNull();
  });
});

describe('shell — schema + metadata', () => {
  test('empty command rejected by schema; over-long command rejected', () => {
    expect(shellTool.input.safeParse({ command: '' }).success).toBe(false);
    expect(shellTool.input.safeParse({ command: 'x'.repeat(9000) }).success).toBe(false);
    expect(shellTool.input.safeParse({ command: 'echo hi' }).success).toBe(true);
  });

  test('is session-serial + surface-risk (never silent in a proactive turn)', () => {
    expect(shellTool.concurrency).toBe('session-serial');
    expect(shellTool.proactiveRisk).toBe('surface');
    // the safety gate classifies it as surface → blocked until Luna surfaces
    expect(proactiveRiskOf(shellTool)).toBe('surface');
  });

  test('summarize reports the exit code', () => {
    expect(shellTool.summarize({ stdout: '', stderr: '', exit_code: 0, timed_out: false })).toContain('exit 0');
    expect(shellTool.summarize({ stdout: '', stderr: '', exit_code: 1, timed_out: true })).toContain('timed out');
  });
});
