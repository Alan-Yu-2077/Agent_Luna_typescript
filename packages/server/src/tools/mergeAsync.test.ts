import { describe, expect, test } from 'bun:test';
import { mergeAsync } from './mergeAsync';

async function* range(start: number, count: number, delayMs: number): AsyncGenerator<number> {
  for (let i = 0; i < count; i++) {
    await Bun.sleep(delayMs);
    yield start + i;
  }
}

async function* throwsAfter(n: number, delayMs: number): AsyncGenerator<number> {
  for (let i = 0; i < n; i++) {
    await Bun.sleep(delayMs);
    yield i;
  }
  throw new Error('source error');
}

describe('mergeAsync', () => {
  test('3 sources of varying speeds deliver all events', async () => {
    const out: number[] = [];
    for await (const v of mergeAsync([range(0, 3, 10), range(10, 3, 5), range(20, 3, 15)])) {
      out.push(v);
    }
    expect(out.length).toBe(9);
    expect(new Set(out)).toEqual(new Set([0, 1, 2, 10, 11, 12, 20, 21, 22]));
  });

  test('throwing source surfaces via onSourceError; siblings keep flowing', async () => {
    const out: number[] = [];
    let errorCalled = false;
    for await (const v of mergeAsync([throwsAfter(2, 5), range(100, 3, 3)], (_idx, _err) => {
      errorCalled = true;
      return -1;
    })) {
      out.push(v);
    }
    expect(errorCalled).toBe(true);
    expect(out).toContain(-1);
    expect(out).toContain(100);
    expect(out).toContain(101);
    expect(out).toContain(102);
  });

  test('consumer break propagates return() to all sources', async () => {
    let aReturned = false;
    let bReturned = false;

    async function* tracked(flag: 'a' | 'b'): AsyncGenerator<number> {
      try {
        for (let i = 0; ; i++) {
          await Bun.sleep(5);
          yield i;
        }
      } finally {
        if (flag === 'a') aReturned = true;
        if (flag === 'b') bReturned = true;
      }
    }

    let count = 0;
    for await (const _ of mergeAsync([tracked('a'), tracked('b')])) {
      if (++count >= 3) break;
    }

    await Bun.sleep(20);

    expect(aReturned).toBe(true);
    expect(bReturned).toBe(true);
  });
});
