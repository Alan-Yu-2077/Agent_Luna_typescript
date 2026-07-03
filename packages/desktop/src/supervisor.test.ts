import { describe, expect, test } from 'bun:test';
import { createSupervisor, type SpawnedChild, type SpawnFn } from './supervisor';

type FakeChild = SpawnedChild & { exit: () => void; error: () => void; killed: boolean };

function fakeSpawner(): { spawnFn: SpawnFn; children: FakeChild[]; envs: Record<string, string>[] } {
  const children: FakeChild[] = [];
  const envs: Record<string, string>[] = [];
  const spawnFn: SpawnFn = (_cmd, _args, env) => {
    envs.push(env);
    let onExit: (() => void) | null = null;
    let onError: (() => void) | null = null;
    const child: FakeChild = {
      pid: children.length + 1,
      killed: false,
      on: ((event: string, cb: () => void) => {
        if (event === 'exit') onExit = cb;
        if (event === 'error') onError = cb;
        return child;
      }) as FakeChild['on'],
      kill: (() => {
        child.killed = true;
        return true;
      }) as FakeChild['kill'],
      exit: () => onExit?.(),
      error: () => onError?.(),
    };
    children.push(child);
    return child;
  };
  return { spawnFn, children, envs };
}

describe('createSupervisor (v0.26.1)', () => {
  test('start spawns exactly once; a second start is a no-op while running', () => {
    const { spawnFn, children } = fakeSpawner();
    const s = createSupervisor({ command: 'x', env: {}, spawnFn });
    s.start();
    s.start();
    expect(children.length).toBe(1);
    expect(s.running()).toBe(true);
  });

  test('a crash restarts up to maxRestarts, then gives up', () => {
    const { spawnFn, children } = fakeSpawner();
    const events: string[] = [];
    const s = createSupervisor({ command: 'x', env: {}, spawnFn, maxRestarts: 2, onEvent: (e) => events.push(e) });
    s.start();
    children[0]!.exit(); // crash 1 → restart
    children[1]!.exit(); // crash 2 → restart
    children[2]!.exit(); // crash 3 → give up
    expect(children.length).toBe(3);
    expect(s.running()).toBe(false);
    expect(events).toEqual([
      'started',
      'exited',
      'restarting',
      'started',
      'exited',
      'restarting',
      'started',
      'exited',
      'gave-up',
    ]);
  });

  test('stop kills the child and DISARMS restarts (the quit path never orphans or respawns)', () => {
    const { spawnFn, children } = fakeSpawner();
    const s = createSupervisor({ command: 'x', env: {}, spawnFn });
    s.start();
    s.stop();
    expect(children[0]!.killed).toBe(true);
    children[0]!.exit(); // the kill's exit event must NOT respawn
    expect(children.length).toBe(1);
    expect(s.running()).toBe(false);
  });

  test('restart kills the old child and spawns a new one with the NEW env (v0.28.0)', () => {
    const { spawnFn, children, envs } = fakeSpawner();
    const s = createSupervisor({ command: 'x', env: { ANTHROPIC_API_KEY: 'old' }, spawnFn });
    s.start();
    s.restart({ ANTHROPIC_API_KEY: 'new' });
    expect(children[0]!.killed).toBe(true);
    expect(children.length).toBe(2);
    expect(envs[0]).toEqual({ ANTHROPIC_API_KEY: 'old' });
    expect(envs[1]).toEqual({ ANTHROPIC_API_KEY: 'new' });
    expect(s.running()).toBe(true);
  });

  test("the OLD child's async exit after a restart does NOT wipe the new child or respawn", () => {
    const { spawnFn, children } = fakeSpawner();
    const s = createSupervisor({ command: 'x', env: {}, spawnFn });
    s.start();
    s.restart({ K: '1' });
    children[0]!.exit(); // stale exit from the killed child — identity-guarded, must be a no-op
    expect(children.length).toBe(2); // no third spawn
    expect(s.running()).toBe(true); // the new child is still current
  });

  test('restart starts the sidecar even if it was never started (first-run onboarding)', () => {
    const { spawnFn, children, envs } = fakeSpawner();
    const s = createSupervisor({ command: 'x', env: {}, spawnFn });
    s.restart({ ANTHROPIC_API_KEY: 'k' }); // never called start()
    expect(children.length).toBe(1);
    expect(envs[0]).toEqual({ ANTHROPIC_API_KEY: 'k' });
    expect(s.running()).toBe(true);
  });

  test('a spawn error (ENOENT) clears the child so a later restart() recovers (v0.28.3)', () => {
    const { spawnFn, children } = fakeSpawner();
    const s = createSupervisor({ command: 'missing', env: {}, spawnFn });
    s.start();
    children[0]!.error(); // ENOENT-style spawn failure — must NOT leave the child wedged
    expect(s.running()).toBe(false);
    // recovery: restart with real keys spawns anew (would be blocked if child stayed set)
    s.restart({ ANTHROPIC_API_KEY: 'k' });
    expect(children.length).toBe(2);
    expect(s.running()).toBe(true);
  });

  test('the new child restarts a fresh crash budget after a restart', () => {
    const { spawnFn, children } = fakeSpawner();
    const s = createSupervisor({ command: 'x', env: {}, spawnFn, maxRestarts: 1 });
    s.start();
    children[0]!.exit(); // crash 1 → restart (budget now spent)
    s.restart({ K: '1' }); // re-arm the budget
    children[2]!.exit(); // crash → should restart again (budget reset)
    expect(children.length).toBe(4);
    expect(s.running()).toBe(true);
  });
});
