import { spawn } from 'node:child_process';
import { connect } from 'node:net';
import type { BackendProbe } from './backend';

// v0.26.1: the sidecar supervisor — the desktop shell owns the luna-server lifecycle (spawn →
// health → bounded crash-restart → KILL ON QUIT). The platforms do not clean up long-running
// children for us: an orphaned luna-server would keep the port + the DB lock after the app closed.
// `spawnFn` is injectable so the restart/kill logic is unit-testable without real processes.
// Structural (not Pick<ChildProcess,…>): the bun-types Node shims type EventEmitter differently.

export type SpawnedChild = {
  pid?: number | undefined;
  on(event: 'exit' | 'error', cb: () => void): unknown;
  kill(signal?: NodeJS.Signals): unknown;
};
export type SpawnFn = (
  cmd: string,
  args: string[],
  env: Record<string, string>,
  cwd?: string,
) => SpawnedChild;
export type KillFn = (child: SpawnedChild) => void;

// v0.38.0: how to kill a child, resolved from platform + pid. On win32 `child.kill()` is
// TerminateProcess on the DIRECT child only — a `bun scripts/dev-all.ts` or a pip/python tree
// leaves grandchildren holding the port + DB lock. `taskkill /T` kills the whole tree. On POSIX we
// keep SIGTERM but arm a SIGKILL escalation so a child that ignores SIGTERM (a wedged python) still
// dies. Pure so the win32 argv is unit-testable off-platform.
export function killPlan(
  platform: NodeJS.Platform,
  pid: number | undefined,
): { kind: 'taskkill'; args: string[] } | { kind: 'signal' } {
  if (platform === 'win32' && pid != null)
    return { kind: 'taskkill', args: ['/pid', String(pid), '/T', '/F'] };
  return { kind: 'signal' };
}

const KILL_GRACE_MS = 4000;

export type SupervisorOpts = {
  command: string;
  args?: string[];
  env: Record<string, string>;
  // v0.28.9: working directory for the child — the dev-all launcher (`bun scripts/dev-all.ts`) uses
  // paths relative to the repo root, so it must run there. Omitted → the parent's cwd.
  cwd?: string;
  maxRestarts?: number; // bounded — a config error must not crash-loop forever
  onEvent?: (e: 'started' | 'exited' | 'restarting' | 'gave-up') => void;
  spawnFn?: SpawnFn;
  killFn?: KillFn; // v0.38.0: injectable so the win32 tree-kill path is testable off-platform
};

export type Supervisor = {
  start(): void;
  stop(): void; // kill the child + disarm restarts (the quit path)
  // v0.45.16: stop AND wait (bounded) for the child to actually exit. "I sent SIGTERM" is not
  // "it is gone" — the old quit path returned immediately, so the next launch could still find
  // the previous sidecar holding the port. Resolves true when the exit was observed.
  stopAndWait(timeoutMs?: number): Promise<boolean>;
  // v0.28.0: re-spawn against a fresh env (onboarding wrote new keys). Kills the current child,
  // re-arms the crash-restart budget, and starts with the new env — so applying keys needs no
  // full app relaunch. A no-op if already stopped.
  restart(env: Record<string, string>): void;
  running(): boolean;
};

// WHY as unknown as: bun-types' node:child_process shim doesn't surface EventEmitter's `on` on the
// ChildProcess type; the runtime object satisfies SpawnedChild structurally.
// windowsHide: a GUI Electron parent spawning a console executable (bun/python/tar) allocates a
// visible console window on win32 unless this is set.
const defaultSpawn: SpawnFn = (cmd, args, env, cwd) =>
  spawn(cmd, args, {
    env,
    cwd,
    stdio: ['ignore', 'inherit', 'inherit'],
    windowsHide: true,
  }) as unknown as SpawnedChild;

const defaultKill: KillFn = (child) => {
  const plan = killPlan(process.platform, child.pid);
  if (plan.kind === 'taskkill') {
    try {
      spawn('taskkill', plan.args, { stdio: 'ignore', windowsHide: true });
    } catch {
      child.kill(); // taskkill unavailable — best-effort direct kill
    }
    return;
  }
  child.kill(); // SIGTERM
  const pid = child.pid;
  if (pid != null) {
    // v0.45.16 (A5 sub-cause): this timer used to be unref'd, so on the quit path Electron's own
    // exit killed it and the SIGKILL escalation NEVER arrived — a sidecar that ignored SIGTERM
    // (one holding on through a long shutdown dream) simply outlived us. Keep it ref'd so the
    // escalation can land, and clear it the moment the child exits so a well-behaved child costs
    // us nothing.
    const t = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        /* already gone */
      }
    }, KILL_GRACE_MS);
    child.on('exit', () => clearTimeout(t));
  }
};

export function createSupervisor(opts: SupervisorOpts): Supervisor {
  const maxRestarts = opts.maxRestarts ?? 3;
  const doSpawn = opts.spawnFn ?? defaultSpawn;
  const doKill = opts.killFn ?? defaultKill;
  let child: SpawnedChild | null = null;
  let restarts = 0;
  let stopped = false;
  let currentEnv = opts.env; // mutable so restart() can re-spawn against a fresh env (v0.28.0)

  const start = (): void => {
    if (stopped || child) return;
    const c = doSpawn(opts.command, opts.args ?? [], currentEnv, opts.cwd);
    child = c;
    opts.onEvent?.('started');
    // A spawn failure (ENOENT/EACCES — missing/unexecutable binary) emits 'error', not 'exit'.
    // Without a listener Node re-throws it as uncaught AND the child ref stays set, wedging start()
    // (its `child` guard early-returns forever). Clear the ref so a later start()/restart() recovers;
    // no auto-restart — a missing binary won't fix itself, and restart() re-arms when keys change.
    c.on('error', () => {
      if (child !== c) return;
      child = null;
      opts.onEvent?.('exited');
    });
    c.on('exit', () => {
      // A restart kills the old child then spawns a new one; the OLD child's (async) exit must not
      // wipe the new `child` or trigger an auto-restart. Identity-guard: only the current child acts.
      if (child !== c) return;
      child = null;
      if (stopped) return;
      opts.onEvent?.('exited');
      if (restarts < maxRestarts) {
        restarts += 1;
        opts.onEvent?.('restarting');
        start();
      } else {
        opts.onEvent?.('gave-up');
      }
    });
  };

  return {
    start,
    stop() {
      stopped = true;
      if (child) doKill(child);
      child = null;
    },
    stopAndWait(timeoutMs = 3000) {
      stopped = true;
      const dying = child;
      child = null;
      if (!dying) return Promise.resolve(true);
      return new Promise<boolean>((resolve) => {
        let settled = false;
        const done = (ok: boolean): void => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(ok);
        };
        const timer = setTimeout(() => done(false), timeoutMs);
        dying.on('exit', () => done(true));
        doKill(dying);
      });
    },
    restart(env: Record<string, string>) {
      currentEnv = env;
      restarts = 0; // fresh crash budget for the new child
      stopped = false; // re-arm (covers the first-run case where the sidecar was never started)
      const old = child;
      child = null; // detach first: `old`'s exit handler sees child !== old → no-op
      if (old) doKill(old);
      start();
    },
    running: () => child !== null,
  };
}

// v0.45.16 (A5): ask the port WHO is there. A TCP connect only proves something is listening;
// /health distinguishes a live luna-server from one that is mid-shutdown (503 + shutting_down)
// and from a stranger's process. Never throws — every failure shape collapses to a verdict.
export async function probeBackend(port: number, timeoutMs = 1500): Promise<BackendProbe> {
  let res: Response;
  try {
    res = await fetch(`http://127.0.0.1:${port}/health`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return { kind: 'absent' }; // refused / unreachable / timed out
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { kind: 'foreign' }; // answers HTTP, but not us
  }
  if (body === null || typeof body !== 'object') return { kind: 'foreign' };
  const b = body as { service?: unknown; pid?: unknown; started_ms?: unknown; shutting_down?: unknown };
  if (b.service !== 'luna-server') return { kind: 'foreign' };
  if (b.shutting_down === true) return { kind: 'shutting-down' };
  return {
    kind: 'healthy',
    pid: typeof b.pid === 'number' ? b.pid : 0,
    startedMs: typeof b.started_ms === 'number' ? b.started_ms : 0,
  };
}

// The mirror of waitForPort: wait until nothing is listening any more. Used when we must take a
// port over from a process that is already leaving — bounded, because a port we cannot claim is a
// problem to report, not to hang on.
export function waitForPortFree(port: number, timeoutMs = 15_000, intervalMs = 250): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve) => {
    const attempt = (): void => {
      const sock = connect({ port, host: '127.0.0.1' });
      sock.once('connect', () => {
        sock.destroy();
        if (Date.now() > deadline) resolve(false);
        else setTimeout(attempt, intervalMs);
      });
      sock.once('error', () => {
        sock.destroy();
        resolve(true); // refused = free
      });
    };
    attempt();
  });
}

// Poll a TCP connect until the sidecar's port answers (the WS server is up) or the deadline passes.
export function waitForPort(port: number, timeoutMs = 15_000, intervalMs = 250): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve) => {
    const attempt = (): void => {
      const sock = connect({ port, host: '127.0.0.1' });
      sock.once('connect', () => {
        sock.destroy();
        resolve(true);
      });
      sock.once('error', () => {
        sock.destroy();
        if (Date.now() > deadline) resolve(false);
        else setTimeout(attempt, intervalMs);
      });
    };
    attempt();
  });
}
