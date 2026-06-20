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
  // When set, the process is spawned from this argv directly (no shell), so a
  // model-supplied path can never be re-interpreted as shell syntax ($()/`…`).
  // `command` stays a human-readable echo for logging/tests. The verify tools
  // (typecheck/run_tests/lint) use this; the `shell` tool does not (it needs zsh).
  argv?: string[];
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

// Collect a process and ALL its descendants (post-order: children before
// parents), by reading one `ps` snapshot and walking the ppid map. Bun.spawn does
// not start a child in its own process group (no `detached` option), so
// `process.kill(-pid)` is unreliable — we enumerate the tree explicitly instead.
// Portable across macOS/Linux (`ps -A -o pid=,ppid=`). Falls back to [rootPid]
// alone if ps is unavailable.
function collectProcessTree(rootPid: number): number[] {
  let childrenOf: Map<number, number[]>;
  try {
    const res = Bun.spawnSync(['ps', '-A', '-o', 'pid=,ppid=']);
    const out = res.stdout ? res.stdout.toString() : '';
    childrenOf = new Map();
    for (const line of out.split('\n')) {
      const m = line.trim().match(/^(\d+)\s+(\d+)$/);
      if (!m) continue;
      const pid = Number(m[1]);
      const ppid = Number(m[2]);
      const arr = childrenOf.get(ppid);
      if (arr) arr.push(pid);
      else childrenOf.set(ppid, [pid]);
    }
  } catch {
    return [rootPid];
  }
  const ordered: number[] = [];
  const seen = new Set<number>();
  const visit = (pid: number) => {
    if (seen.has(pid)) return; // guard against a pathological cycle
    seen.add(pid);
    for (const c of childrenOf.get(pid) ?? []) visit(c);
    ordered.push(pid); // post-order — grandchildren die before the parent
  };
  visit(rootPid);
  return ordered;
}

// Real spawner — exec via Bun.spawn (argv for verify tools, else `/bin/zsh -lc`),
// wired to the abort signal (dispatcher timeout). On timeout/abort the process
// TREE is killed by enumerating descendants and signalling each, so a child
// spawned by the command can't outlive it. Output is capped after collection.
// Never throws on a non-zero exit; only a genuine spawn failure rejects.
export const realSpawner: Spawner = async (req) => {
  let timedOut = false;
  const proc = Bun.spawn(req.argv ?? ['/bin/zsh', '-lc', req.command], {
    cwd: req.cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const killTree = (signal: NodeJS.Signals) => {
    for (const pid of collectProcessTree(proc.pid)) {
      try {
        process.kill(pid, signal);
      } catch {
        /* already gone */
      }
    }
  };

  let escalation: ReturnType<typeof setTimeout> | null = null;
  const escalateKill = () => {
    timedOut = true;
    killTree('SIGTERM');
    if (escalation) clearTimeout(escalation);
    escalation = setTimeout(() => killTree('SIGKILL'), 2000);
    escalation.unref?.();
  };

  if (req.abortSignal.aborted) {
    escalateKill();
  } else {
    req.abortSignal.addEventListener('abort', escalateKill, { once: true });
  }

  const timer = setTimeout(escalateKill, req.timeoutMs);

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
    if (escalation) clearTimeout(escalation); // never leave a dangling SIGKILL timer
    req.abortSignal.removeEventListener('abort', escalateKill);
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
