import { describe, expect, test } from 'bun:test';
import { z } from 'zod';
import { defineTool, type InternalEvent } from './defineTool';

describe('defineTool (v0.20.9 coverage)', () => {
  const tool = defineTool({
    name: 'time_now',
    description: 'd',
    input: z.object({}),
    output: z.object({ ok: z.literal(true) }),
    concurrency: 'safe-parallel',
    proactiveRisk: 'safe',
    timeoutMs: 1000,
    summarize: (o) => (o.ok ? 'ok' : 'no'),
    execute: async function* () {
      yield { kind: 'ok', data: { ok: true as const } };
    },
  });

  test('preserves the spec fields as a Tool', () => {
    expect(tool.name).toBe('time_now');
    expect(tool.concurrency).toBe('safe-parallel');
    expect(tool.proactiveRisk).toBe('safe');
    expect(tool.timeoutMs).toBe(1000);
  });

  test('summarize + execute pass through', async () => {
    expect(tool.summarize({ ok: true })).toBe('ok');
    const events: InternalEvent<unknown>[] = [];
    for await (const e of tool.execute({}, {
      sessionId: 's',
      callId: 'c',
      abortSignal: new AbortController().signal,
    })) {
      events.push(e);
    }
    expect(events).toEqual([{ kind: 'ok', data: { ok: true } }]);
  });

  test('input/output remain the provided zod schemas', () => {
    expect(tool.input.safeParse({}).success).toBe(true);
    expect(tool.output.safeParse({ ok: true }).success).toBe(true);
    expect(tool.output.safeParse({ ok: false }).success).toBe(false);
  });
});
