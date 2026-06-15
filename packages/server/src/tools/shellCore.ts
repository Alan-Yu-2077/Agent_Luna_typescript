// Shell spawner core (Initiative 8, v0.15.2) — the injectable process runner the
// `shell` tool and the verify tools (typecheck/run_tests/lint) share, plus the
// output cap. Injectable so tests run no real destructive command, and so the
// v0.15.4 skill-runner can reuse the same abstraction (plan note: "don't
// foreclose").

export const SHELL_DEFAULT_TIMEOUT_MS = 120_000; // 120 s
export const SHELL_MAX_TIMEOUT_MS = 1_800_000; // 1800 s hard ceiling
export const SHELL_MAX_OUTPUT_CHARS = 120_000; // ~120 KB, middle-elided

export type SpawnRequest = {
  command: string;
  cwd: string;
  timeoutMs: number;
  abortSignal: AbortSignal;
};

export type SpawnResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
};

export type Spawner = (req: SpawnRequest) => Promise<SpawnResult>;

// Middle-elide so both the head (the command echo / first errors) and the tail
// (the final summary / exit message) survive a cap. A bin/end split keeps the
// most diagnostic regions; the elision marker reports how many chars were cut.
export function capOutput(text: string, max = SHELL_MAX_OUTPUT_CHARS): string {
  if (text.length <= max) return text;
  const marker = (n: number) => `\n…[${n} chars elided]…\n`;
  // Reserve room for the marker; split the remaining budget head/tail.
  const sampleMarker = marker(text.length);
  const budget = Math.max(0, max - sampleMarker.length);
  const head = Math.ceil(budget * 0.6);
  const tail = budget - head;
  const elided = text.length - head - tail;
  return text.slice(0, head) + marker(elided) + text.slice(text.length - tail);
}

// Real spawner — `/bin/zsh -lc <command>` via Bun.spawn, wired to the abort
// signal (dispatcher timeout). On timeout/abort the process TREE is killed
// (negative pid → process group) so a child spawned by the command can't outlive
// it. Output is capped after collection. Never throws on a non-zero exit; only a
// genuine spawn failure rejects.
export const realSpawner: Spawner = async (req) => {
  let timedOut = false;
  const proc = Bun.spawn(['/bin/zsh', '-lc', req.command], {
    cwd: req.cwd,
    stdout: 'pipe',
    stderr: 'pipe',
    // detached so we own a process group we can signal as a unit.
    // Bun spawns in a new group; killing the group reaps children.
  });

  const killTree = (signal: NodeJS.Signals) => {
    try {
      // negative pid signals the whole process group (the tree).
      process.kill(-proc.pid, signal);
    } catch {
      try {
        proc.kill(signal === 'SIGKILL' ? 9 : 15);
      } catch {
        /* already gone */
      }
    }
  };

  const onAbort = () => {
    timedOut = true;
    killTree('SIGTERM');
    // escalate if it ignores SIGTERM
    setTimeout(() => killTree('SIGKILL'), 2000).unref?.();
  };

  if (req.abortSignal.aborted) {
    onAbort();
  } else {
    req.abortSignal.addEventListener('abort', onAbort, { once: true });
  }

  const timer = setTimeout(() => {
    timedOut = true;
    killTree('SIGTERM');
    setTimeout(() => killTree('SIGKILL'), 2000).unref?.();
  }, req.timeoutMs);

  try {
    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    const exitCode = await proc.exited;
    return {
      stdout: capOutput(stdout),
      stderr: capOutput(stderr),
      exitCode: timedOut ? exitCode || 124 : exitCode,
      timedOut,
    };
  } finally {
    clearTimeout(timer);
    req.abortSignal.removeEventListener('abort', onAbort);
  }
};

// Test/skill-runner injection seam. When set, the `shell` tool and verify tools
// route through this spawner instead of the real one — so tests assert against a
// fake without spawning a real (let alone destructive) process.
let injected: Spawner | null = null;
export function setSpawnerForTests(spawner: Spawner | null): void {
  injected = spawner;
}
export function activeSpawner(): Spawner {
  return injected ?? realSpawner;
}

// Clamp a requested timeout into [1, SHELL_MAX_TIMEOUT_MS], defaulting when unset.
export function clampTimeout(requestedMs: number | undefined): number {
  if (requestedMs === undefined) return SHELL_DEFAULT_TIMEOUT_MS;
  return Math.min(Math.max(1, requestedMs), SHELL_MAX_TIMEOUT_MS);
}
