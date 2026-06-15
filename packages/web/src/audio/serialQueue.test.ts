import { describe, expect, test } from 'bun:test';
import { SerialQueue } from './serialQueue';

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

describe('SerialQueue', () => {
  test('runs tasks strictly serially even when enqueued concurrently (no overlap)', async () => {
    const q = new SerialQueue();
    const log: string[] = [];
    const task = (id: string, ms: number) => async (): Promise<void> => {
      log.push(`start ${id}`);
      await sleep(ms);
      log.push(`end ${id}`);
    };
    const a = q.run(task('a', 20));
    const b = q.run(task('b', 5));
    const c = q.run(task('c', 5));
    await Promise.all([a, b, c]);
    expect(log).toEqual(['start a', 'end a', 'start b', 'end b', 'start c', 'end c']);
  });

  test('a throwing task does not break the chain', async () => {
    const q = new SerialQueue();
    const log: string[] = [];
    const a = q.run(async () => {
      throw new Error('boom');
    });
    const b = q.run(async () => {
      log.push('b ran');
    });
    await a.catch(() => undefined);
    await b;
    expect(log).toEqual(['b ran']);
  });

  test('clear() cancels tasks still waiting; the running one finishes', async () => {
    const q = new SerialQueue();
    const log: string[] = [];
    q.run(async () => {
      log.push('a start');
      await sleep(30);
      log.push('a end');
    });
    await sleep(5); // let a actually begin
    void q.run(async () => {
      log.push('b ran');
    });
    q.clear();
    await sleep(50);
    expect(log).toContain('a start');
    expect(log).toContain('a end');
    expect(log).not.toContain('b ran');
  });
});
