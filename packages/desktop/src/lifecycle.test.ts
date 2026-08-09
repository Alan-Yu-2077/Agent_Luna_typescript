import { describe, expect, it } from 'bun:test';
import { createSupervisor, probeBackend, waitForPortFree, type SpawnedChild } from './supervisor';
import { shouldAttach } from './backend';

// v0.45.16 (Initiative 37, A5) — "the port is listening" was never ownership. The repro that
// opened this version: a stand-in sidecar that answers a TCP connect and dies four seconds later
// made the real `shouldAttach` say ATTACH, so the relaunched app spawned nothing and lost the
// backend when the corpse finally exited. These tests pin the replacement: ask WHO is there.

function serveJson(body: unknown, status = 200): { port: number; stop: () => void } {
  const server = Bun.serve({
    port: 0,
    fetch: () => Response.json(body, { status }),
  });
  return { port: Number(server.port), stop: () => server.stop(true) };
}

describe('probeBackend (A5 — who is on the port)', () => {
  it('a live luna-server → healthy, with its pid and start time', async () => {
    const s = serveJson({
      service: 'luna-server',
      pid: 4242,
      started_ms: 1_700_000_000_000,
      shutting_down: false,
    });
    try {
      const probe = await probeBackend(s.port, 1000);
      expect(probe).toEqual({ kind: 'healthy', pid: 4242, startedMs: 1_700_000_000_000 });
      expect(shouldAttach({ probe, smoke: false })).toBe(true);
    } finally {
      s.stop();
    }
  });

  it('a backend running its shutdown dream → shutting-down, and is NOT adopted', async () => {
    const s = serveJson(
      { service: 'luna-server', pid: 4242, started_ms: 1, shutting_down: true },
      503,
    );
    try {
      const probe = await probeBackend(s.port, 1000);
      expect(probe.kind).toBe('shutting-down');
      expect(shouldAttach({ probe, smoke: false })).toBe(false);
    } finally {
      s.stop();
    }
  });

  it("a stranger's server on the port → foreign, never adopted", async () => {
    const s = serveJson({ hello: 'i am not luna' });
    try {
      const probe = await probeBackend(s.port, 1000);
      expect(probe.kind).toBe('foreign');
      expect(shouldAttach({ probe, smoke: false })).toBe(false);
    } finally {
      s.stop();
    }
  });

  it('nothing listening → absent (and never throws)', async () => {
    const s = serveJson({ service: 'luna-server', pid: 1, started_ms: 1, shutting_down: false });
    const port = s.port;
    s.stop();
    const probe = await probeBackend(port, 500);
    expect(probe.kind).toBe('absent');
  });
});

describe('waitForPortFree (taking a port over from someone leaving)', () => {
  it('resolves true once the holder lets go', async () => {
    const s = serveJson({ service: 'luna-server', pid: 1, started_ms: 1, shutting_down: true });
    setTimeout(() => s.stop(), 300);
    expect(await waitForPortFree(s.port, 5000, 100)).toBe(true);
  });

  it('gives up (false) rather than hanging on a port that is never released', async () => {
    const s = serveJson({ service: 'luna-server', pid: 1, started_ms: 1, shutting_down: true });
    try {
      expect(await waitForPortFree(s.port, 400, 100)).toBe(false);
    } finally {
      s.stop();
    }
  });
});

describe('supervisor.stopAndWait (v0.45.16 — "I sent SIGTERM" is not "it is gone")', () => {
  function fakeChild(): SpawnedChild & { fire: (ev: 'exit' | 'error') => void; killed: number } {
    const handlers: Record<string, Array<() => void>> = {};
    return {
      pid: 999,
      killed: 0,
      on(event: 'exit' | 'error', cb: () => void) {
        (handlers[event] ??= []).push(cb);
        return this;
      },
      kill() {
        this.killed += 1;
        return true;
      },
      fire(ev) {
        for (const cb of handlers[ev] ?? []) cb();
      },
    };
  }

  it('resolves true when the child actually exits', async () => {
    const child = fakeChild();
    const sup = createSupervisor({
      command: 'x',
      env: {},
      spawnFn: () => child,
      killFn: (c) => {
        c.kill();
        setTimeout(() => child.fire('exit'), 10);
      },
    });
    sup.start();
    expect(await sup.stopAndWait(1000)).toBe(true);
    expect(sup.running()).toBe(false);
  });

  it('resolves false (bounded) when the child ignores the signal — the caller is never hung', async () => {
    const child = fakeChild();
    const sup = createSupervisor({
      command: 'x',
      env: {},
      spawnFn: () => child,
      killFn: (c) => c.kill(), // never exits
    });
    sup.start();
    const t0 = Date.now();
    expect(await sup.stopAndWait(200)).toBe(false);
    expect(Date.now() - t0).toBeLessThan(2000);
  });

  it('a stopped supervisor does not auto-restart the corpse', async () => {
    const child = fakeChild();
    const events: string[] = [];
    const sup = createSupervisor({
      command: 'x',
      env: {},
      spawnFn: () => child,
      killFn: (c) => {
        c.kill();
        setTimeout(() => child.fire('exit'), 5);
      },
      onEvent: (e) => events.push(e),
    });
    sup.start();
    await sup.stopAndWait(500);
    await Bun.sleep(20);
    expect(events.filter((e) => e === 'restarting')).toEqual([]);
  });

  it('stopping when nothing is running is a no-op that still resolves', async () => {
    const sup = createSupervisor({ command: 'x', env: {}, spawnFn: () => fakeChild() });
    expect(await sup.stopAndWait(100)).toBe(true);
  });
});
