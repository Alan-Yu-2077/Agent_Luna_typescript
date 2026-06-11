import { describe, expect, test } from 'bun:test';
import { Mutex } from './mutex';

describe('Mutex', () => {
  test('FIFO order across 3 acquirers', async () => {
    const m = new Mutex();
    const order: number[] = [];

    const r1 = await m.acquire();

    const p2 = m.acquire().then((r) => {
      order.push(2);
      r();
    });
    const p3 = m.acquire().then((r) => {
      order.push(3);
      r();
    });

    order.push(1);
    r1();

    await Promise.all([p2, p3]);

    expect(order).toEqual([1, 2, 3]);
  });

  test('acquire with already-aborted signal rejects immediately', async () => {
    const m = new Mutex();
    const ac = new AbortController();
    ac.abort();

    await expect(m.acquire(ac.signal)).rejects.toThrow('Mutex acquire aborted');
  });

  test('aborted acquirer is removed from queue; subsequent acquirers still drain', async () => {
    const m = new Mutex();
    const r1 = await m.acquire();

    const ac = new AbortController();
    const p2 = m.acquire(ac.signal).catch((e: Error) => e.message);
    const p3 = m.acquire().then((r) => {
      r();
      return 'p3-ran';
    });

    ac.abort();
    expect(await p2).toBe('Mutex acquire aborted');

    r1();
    expect(await p3).toBe('p3-ran');
  });

  test('releaser is idempotent (calling twice is no-op)', async () => {
    const m = new Mutex();
    const r1 = await m.acquire();
    r1();
    r1();
    const r2 = await m.acquire();
    r2();
  });
});
