import { describe, expect, test } from 'bun:test';
import { createSupervisor, type SpawnedChild, type SpawnFn } from './supervisor';

type FakeChild = SpawnedChild & { exit: () => void; killed: boolean };

function fakeSpawner(): { spawnFn: SpawnFn; children: FakeChild[] } {
  const children: FakeChild[] = [];
  const spawnFn: SpawnFn = () => {
    let onExit: (() => void) | null = null;
    const child: FakeChild = {
      pid: children.length + 1,
      killed: false,
      on: ((event: string, cb: () => void) => {
        if (event === 'exit') onExit = cb;
        return child;
      }) as FakeChild['on'],
      kill: (() => {
        child.killed = true;
        return true;
      }) as FakeChild['kill'],
      exit: () => onExit?.(),
    };
    children.push(child);
    return child;
  };
  return { spawnFn, children };
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
});
