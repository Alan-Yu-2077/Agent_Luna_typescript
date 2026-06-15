import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { InternalEvent } from '../defineTool';
import { planTool } from './plan';
import { getSession, resetSessions } from '../../turn/session';

const ctx = (sessionId: string) => ({
  sessionId,
  callId: 'c1',
  abortSignal: new AbortController().signal,
});

type PlanOut = { plan: { id: string; text: string; status: string }[] };

async function run(
  sessionId: string,
  input: unknown,
): Promise<{ events: InternalEvent<PlanOut>[]; ok: PlanOut | null; progress: PlanOut | null }> {
  const events: InternalEvent<PlanOut>[] = [];
  for await (const e of planTool.execute(input as never, ctx(sessionId))) {
    events.push(e as InternalEvent<PlanOut>);
  }
  let ok: PlanOut | null = null;
  let progress: PlanOut | null = null;
  for (const e of events) {
    if (e.kind === 'ok') ok = e.data;
    if (e.kind === 'progress') progress = e.payload as PlanOut;
  }
  return { events, ok, progress };
}

beforeEach(() => resetSessions());
afterEach(() => resetSessions());

describe('plan tool', () => {
  test('set → get round-trips', async () => {
    const setRes = await run('s1', {
      action: 'set',
      items: [{ text: 'read the file' }, { text: 'edit it' }, { text: 'run tests' }],
    });
    expect(setRes.ok!.plan.length).toBe(3);
    expect(setRes.ok!.plan[0]!.text).toBe('read the file');
    expect(setRes.ok!.plan.every((i) => i.status === 'pending')).toBe(true);
    // ids are auto-assigned and unique
    const ids = setRes.ok!.plan.map((i) => i.id);
    expect(new Set(ids).size).toBe(3);

    const getRes = await run('s1', { action: 'get' });
    expect(getRes.ok!.plan.length).toBe(3);
    expect(getRes.ok!.plan.map((i) => i.text)).toEqual(['read the file', 'edit it', 'run tests']);
  });

  test('update flips a status by id', async () => {
    const setRes = await run('s2', {
      action: 'set',
      items: [{ text: 'step one' }, { text: 'step two' }],
    });
    const firstId = setRes.ok!.plan[0]!.id;

    const upd = await run('s2', {
      action: 'update',
      items: [{ id: firstId, text: 'step one', status: 'done' }],
    });
    const updated = upd.ok!.plan.find((i) => i.id === firstId);
    expect(updated!.status).toBe('done');
    // the other item is untouched
    expect(upd.ok!.plan.find((i) => i.id !== firstId)!.status).toBe('pending');
  });

  test('update appends a new item when the id is unknown', async () => {
    await run('s3', { action: 'set', items: [{ text: 'a' }] });
    const upd = await run('s3', { action: 'update', items: [{ text: 'b', status: 'in_progress' }] });
    expect(upd.ok!.plan.length).toBe(2);
    expect(upd.ok!.plan[1]!.text).toBe('b');
    expect(upd.ok!.plan[1]!.status).toBe('in_progress');
  });

  test('emits a progress event carrying the plan snapshot', async () => {
    const res = await run('s4', { action: 'set', items: [{ text: 'only step' }] });
    expect(res.progress).not.toBeNull();
    expect(res.progress!.plan.length).toBe(1);
    expect(res.progress!.plan[0]!.text).toBe('only step');
    // progress precedes the final ok
    const kinds = res.events.map((e) => e.kind);
    expect(kinds.indexOf('progress')).toBeLessThan(kinds.indexOf('ok'));
  });

  test('the plan lives on the session object', async () => {
    await run('s5', { action: 'set', items: [{ text: 'x' }] });
    expect(getSession('s5').plan.length).toBe(1);
    expect(getSession('s5').plan[0]!.text).toBe('x');
  });

  test('summarize reports done/total', () => {
    expect(
      planTool.summarize({
        plan: [
          { id: 's1', text: 'a', status: 'done' },
          { id: 's2', text: 'b', status: 'pending' },
        ],
      }),
    ).toBe('plan: 1/2 done');
  });

  test('set with no items clears the plan', async () => {
    await run('s6', { action: 'set', items: [{ text: 'a' }] });
    const cleared = await run('s6', { action: 'set', items: [] });
    expect(cleared.ok!.plan.length).toBe(0);
  });
});
