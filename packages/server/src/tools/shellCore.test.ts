import { describe, expect, test } from 'bun:test';
import {
  capOutput,
  clampTimeout,
  realSpawner,
  SHELL_DEFAULT_TIMEOUT_MS,
  SHELL_MAX_OUTPUT_CHARS,
  SHELL_MAX_TIMEOUT_MS,
} from './shellCore';

describe('capOutput (middle-elide)', () => {
  test('short text passes through unchanged', () => {
    expect(capOutput('hello', 100)).toBe('hello');
  });

  test('over-cap text is elided in the MIDDLE, keeping head and tail', () => {
    const head = 'HEAD'.repeat(50);
    const tail = 'TAIL'.repeat(50);
    const mid = 'x'.repeat(5000);
    const out = capOutput(head + mid + tail, 500);
    expect(out.length).toBeLessThanOrEqual(500);
    expect(out.startsWith('HEAD')).toBe(true);
    expect(out.endsWith('TAIL')).toBe(true);
    expect(out).toContain('chars elided');
  });

  test('default cap is ~120 KB', () => {
    const big = 'a'.repeat(SHELL_MAX_OUTPUT_CHARS + 1000);
    const out = capOutput(big);
    expect(out.length).toBeLessThanOrEqual(SHELL_MAX_OUTPUT_CHARS);
    expect(out).toContain('elided');
  });
});

describe('clampTimeout', () => {
  test('undefined → default', () => {
    expect(clampTimeout(undefined)).toBe(SHELL_DEFAULT_TIMEOUT_MS);
  });
  test('clamps to the hard max', () => {
    expect(clampTimeout(SHELL_MAX_TIMEOUT_MS * 10)).toBe(SHELL_MAX_TIMEOUT_MS);
  });
  test('floors at 1', () => {
    expect(clampTimeout(0)).toBe(1);
    expect(clampTimeout(-5)).toBe(1);
  });
  test('passes through an in-range value', () => {
    expect(clampTimeout(5000)).toBe(5000);
  });
});

describe('realSpawner argv path (no shell interpretation — v0.20.0)', () => {
  const req = (over: Partial<Parameters<typeof realSpawner>[0]>) => ({
    command: '',
    cwd: process.cwd(),
    timeoutMs: 10_000,
    abortSignal: new AbortController().signal,
    ...over,
  });

  test('argv passes $() / backticks as a LITERAL arg, never executes them', async () => {
    // /bin/echo prints its argv verbatim. If a shell had interpreted the arg, the
    // command substitution would have run and stdout would differ from the literal.
    const r = await realSpawner(req({ argv: ['/bin/echo', '$(echo INJECTED)', '`echo INJECTED`'] }));
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toBe('$(echo INJECTED) `echo INJECTED`\n');
    expect(r.stdout).not.toContain('INJECTED\n'); // i.e. not the substituted form
  });

  test('the zsh `command` path DOES interpret $() — proving argv is the safe difference', async () => {
    const r = await realSpawner(req({ command: 'echo $(echo INJECTED)' }));
    expect(r.stdout.trim()).toBe('INJECTED');
  });
});

describe('realSpawner process-tree kill (v0.20.2 — no leaked grandchildren)', () => {
  const isAlive = (pid: number): boolean => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  };

  test('a timed-out command kills its backgrounded grandchild', async () => {
    const ctl = new AbortController();
    // background a long sleep, print its pid, then block the parent on wait —
    // so the parent is alive when the 400ms timeout fires.
    const r = await realSpawner({
      command: 'sleep 30 & echo $!; wait',
      cwd: process.cwd(),
      timeoutMs: 400,
      abortSignal: ctl.signal,
    });
    expect(r.timedOut).toBe(true);
    const childPid = Number(r.stdout.trim().split('\n')[0]);
    expect(Number.isInteger(childPid)).toBe(true);
    // poll: the grandchild must die (SIGTERM→SIGKILL), not outlive the parent.
    let alive = true;
    for (let i = 0; i < 40 && alive; i++) {
      alive = isAlive(childPid);
      if (alive) await new Promise((res) => setTimeout(res, 50));
    }
    expect(alive).toBe(false);
  }, 10_000);
});
