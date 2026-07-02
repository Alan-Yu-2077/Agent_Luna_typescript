import { spawn } from 'node:child_process';
import { connect } from 'node:net';

// v0.26.1: the sidecar supervisor — the desktop shell owns the luna-server lifecycle (spawn →
// health → bounded crash-restart → KILL ON QUIT). The platforms do not clean up long-running
// children for us: an orphaned luna-server would keep the port + the DB lock after the app closed.
// `spawnFn` is injectable so the restart/kill logic is unit-testable without real processes.
// Structural (not Pick<ChildProcess,…>): the bun-types Node shims type EventEmitter differently.

export type SpawnedChild = {
  pid?: number | undefined;
  on(event: 'exit', cb: () => void): unknown;
  kill(): unknown;
};
export type SpawnFn = (cmd: string, args: string[], env: Record<string, string>) => SpawnedChild;

export type SupervisorOpts = {
  command: string;
  args?: string[];
  env: Record<string, string>;
  maxRestarts?: number; // bounded — a config error must not crash-loop forever
  onEvent?: (e: 'started' | 'exited' | 'restarting' | 'gave-up') => void;
  spawnFn?: SpawnFn;
};

export type Supervisor = {
  start(): void;
  stop(): void; // kill the child + disarm restarts (the quit path)
  running(): boolean;
};

// WHY as unknown as: bun-types' node:child_process shim doesn't surface EventEmitter's `on` on the
// ChildProcess type; the runtime object satisfies SpawnedChild structurally.
const defaultSpawn: SpawnFn = (cmd, args, env) =>
  spawn(cmd, args, { env, stdio: ['ignore', 'inherit', 'inherit'] }) as unknown as SpawnedChild;

export function createSupervisor(opts: SupervisorOpts): Supervisor {
  const maxRestarts = opts.maxRestarts ?? 3;
  const doSpawn = opts.spawnFn ?? defaultSpawn;
  let child: SpawnedChild | null = null;
  let restarts = 0;
  let stopped = false;

  const start = (): void => {
    if (stopped || child) return;
    child = doSpawn(opts.command, opts.args ?? [], opts.env);
    opts.onEvent?.('started');
    child.on('exit', () => {
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
      child?.kill();
      child = null;
    },
    running: () => child !== null,
  };
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
