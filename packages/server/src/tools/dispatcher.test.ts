import { describe, expect, test } from 'bun:test';
import { z } from 'zod';
import type { ToolCall, ToolEvent, ToolName } from '@luna/protocol';
import { defineTool, type Tool } from './defineTool';
import { dispatchToolCalls, MAX_CONCURRENT_TOOLS_PER_SESSION } from './dispatcher';
import { Mutex } from './mutex';
import type { ToolRegistry } from './registry';

type ActiveTrack = { active: number; maxActive: number };
type CleanupTrack = { cleanupRan: boolean };
type ExecutedTrack = { executed: number };

function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('aborted'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new Error('aborted'));
      },
      { once: true },
    );
  });
}

function makeSleepTool(opts: {
  name: ToolName;
  concurrency: 'safe-parallel' | 'session-serial' | 'global-serial';
  sleepMs: number;
  timeoutMs?: number;
  trackActive?: ActiveTrack;
  trackCleanup?: CleanupTrack;
  trackExecuted?: ExecutedTrack;
}): Tool {
  return defineTool({
    name: opts.name,
    description: 'test sleep tool',
    input: z.object({}),
    output: z.object({ ok: z.literal(true) }),
    concurrency: opts.concurrency,
    timeoutMs: opts.timeoutMs ?? 1000,
    summarize: () => 'slept',
    execute: async function* (_input, ctx) {
      if (opts.trackExecuted) opts.trackExecuted.executed++;
      if (opts.trackActive) {
        opts.trackActive.active++;
        opts.trackActive.maxActive = Math.max(opts.trackActive.maxActive, opts.trackActive.active);
      }
      try {
        try {
          await abortableSleep(opts.sleepMs, ctx.abortSignal);
        } catch {
          return;
        }
        yield { kind: 'ok', data: { ok: true as const } };
      } finally {
        if (opts.trackActive) opts.trackActive.active--;
        if (opts.trackCleanup) opts.trackCleanup.cleanupRan = true;
      }
    },
  });
}

function makeCtx(sessionId = 'test'): { sessionId: string; sessionMutex: Mutex } {
  return { sessionId, sessionMutex: new Mutex() };
}

function makeRegistry(tool: Tool): ToolRegistry {
  return { time_now: tool, read_file: tool, remember: tool, enter_dream: tool };
}

async function collect(gen: AsyncGenerator<ToolEvent>): Promise<ToolEvent[]> {
  const events: ToolEvent[] = [];
  for await (const e of gen) events.push(e);
  return events;
}

function expectErrCode(event: ToolEvent | undefined): string | undefined {
  if (!event || event.kind !== 'final') return undefined;
  if (event.result.kind !== 'err') return undefined;
  return event.result.code;
}

describe('dispatcher', () => {
  test('1. validation_failed without invoking execute', async () => {
    const executed: ExecutedTrack = { executed: 0 };
    const tool = defineTool({
      name: 'time_now',
      description: 'x',
      input: z.object({ required: z.string() }),
      output: z.object({}),
      concurrency: 'safe-parallel',
      timeoutMs: 1000,
      summarize: () => 'x',
      execute: async function* () {
        executed.executed++;
        yield { kind: 'ok', data: {} };
      },
    });
    const registry = makeRegistry(tool);

    const calls: ToolCall[] = [
      { call_id: 'c1', tool_name: 'time_now', input: { wrong_field: 1 } },
    ];
    const events = await collect(dispatchToolCalls(calls, makeCtx(), registry));

    expect(expectErrCode(events.find((e) => e.kind === 'final'))).toBe('validation_failed');
    expect(executed.executed).toBe(0);
    expect(events.find((e) => e.kind === 'started')).toBeUndefined();
  });

  test('2. safe-parallel actually overlaps (maxActive === 3)', async () => {
    const track: ActiveTrack = { active: 0, maxActive: 0 };
    const tool = makeSleepTool({
      name: 'time_now',
      concurrency: 'safe-parallel',
      sleepMs: 30,
      trackActive: track,
    });
    const registry = makeRegistry(tool);

    await collect(
      dispatchToolCalls(
        [
          { call_id: 'a', tool_name: 'time_now', input: {} },
          { call_id: 'b', tool_name: 'time_now', input: {} },
          { call_id: 'c', tool_name: 'time_now', input: {} },
        ],
        makeCtx(),
        registry,
      ),
    );

    expect(track.maxActive).toBe(3);
  });

  test('3. session-serial actually serializes (maxActive === 1)', async () => {
    const track: ActiveTrack = { active: 0, maxActive: 0 };
    const tool = makeSleepTool({
      name: 'remember',
      concurrency: 'session-serial',
      sleepMs: 20,
      trackActive: track,
    });
    const registry = makeRegistry(tool);

    await collect(
      dispatchToolCalls(
        [
          { call_id: 'a', tool_name: 'remember', input: {} },
          { call_id: 'b', tool_name: 'remember', input: {} },
          { call_id: 'c', tool_name: 'remember', input: {} },
        ],
        makeCtx(),
        registry,
      ),
    );

    expect(track.maxActive).toBe(1);
  });

  test('4. timeout aborts and finally runs', async () => {
    const cleanup: CleanupTrack = { cleanupRan: false };
    const tool = makeSleepTool({
      name: 'time_now',
      concurrency: 'safe-parallel',
      sleepMs: 300,
      timeoutMs: 30,
      trackCleanup: cleanup,
    });
    const registry = makeRegistry(tool);

    const events = await collect(
      dispatchToolCalls(
        [{ call_id: 'c1', tool_name: 'time_now', input: {} }],
        makeCtx(),
        registry,
      ),
    );

    expect(expectErrCode(events.find((e) => e.kind === 'final'))).toBe('timeout');
    await Bun.sleep(50);
    expect(cleanup.cleanupRan).toBe(true);
  });

  test('5. streaming order: 1 started + 5 progress + 1 final', async () => {
    const tool = defineTool({
      name: 'time_now',
      description: 'x',
      input: z.object({}),
      output: z.object({ ok: z.literal(true) }),
      concurrency: 'safe-parallel',
      timeoutMs: 1000,
      summarize: () => 'x',
      execute: async function* () {
        for (let i = 0; i < 5; i++) {
          yield { kind: 'progress', payload: { step: i } };
        }
        yield { kind: 'ok', data: { ok: true as const } };
      },
    });
    const registry = makeRegistry(tool);

    const events = await collect(
      dispatchToolCalls(
        [{ call_id: 'c1', tool_name: 'time_now', input: {} }],
        makeCtx(),
        registry,
      ),
    );

    const started = events.filter((e) => e.kind === 'started');
    const progress = events.filter((e) => e.kind === 'progress');
    const finals = events.filter((e) => e.kind === 'final');

    expect(started.length).toBe(1);
    expect(progress.length).toBe(5);
    expect(finals.length).toBe(1);
    expect(events[0]?.kind).toBe('started');
    expect(events.at(-1)?.kind).toBe('final');
    for (const e of events) {
      expect(e.call_id).toBe('c1');
    }
  });

  test('6. output schema mismatch yields validation_failed', async () => {
    const tool: Tool = {
      name: 'time_now',
      description: 'x',
      input: z.object({}),
      output: z.object({ required_field: z.string() }),
      concurrency: 'safe-parallel',
      timeoutMs: 1000,
      summarize: () => 'x',
      execute: async function* () {
        yield { kind: 'ok', data: { other: 'wrong shape' } };
      },
    };
    const registry = makeRegistry(tool);

    const events = await collect(
      dispatchToolCalls(
        [{ call_id: 'c1', tool_name: 'time_now', input: {} }],
        makeCtx(),
        registry,
      ),
    );

    const final = events.find((e) => e.kind === 'final');
    expect(expectErrCode(final)).toBe('validation_failed');
    if (final?.kind === 'final' && final.result.kind === 'err') {
      expect(final.result.message).toContain('output schema mismatch');
    }
  });

  test('7. tool_not_found for unregistered tool_name', async () => {
    const tool = makeSleepTool({
      name: 'time_now',
      concurrency: 'safe-parallel',
      sleepMs: 0,
    });
    const registry = makeRegistry(tool);

    // @ts-expect-error: testing dispatcher's tool_not_found path requires bypassing the enum
    const calls: ToolCall[] = [{ call_id: 'c1', tool_name: 'no_such_tool', input: {} }];
    const events = await collect(dispatchToolCalls(calls, makeCtx(), registry));

    expect(expectErrCode(events.find((e) => e.kind === 'final'))).toBe('tool_not_found');
    expect(events.find((e) => e.kind === 'started')).toBeUndefined();
  });

  test('8. per-session concurrent cap: 9th call rejected', async () => {
    const tool = makeSleepTool({
      name: 'time_now',
      concurrency: 'safe-parallel',
      sleepMs: 5,
    });
    const registry = makeRegistry(tool);

    const calls: ToolCall[] = Array.from(
      { length: MAX_CONCURRENT_TOOLS_PER_SESSION + 1 },
      (_, i) => ({
        call_id: `c${i}`,
        tool_name: 'time_now' as const,
        input: {},
      }),
    );

    const events = await collect(dispatchToolCalls(calls, makeCtx(), registry));

    const ninthId = `c${MAX_CONCURRENT_TOOLS_PER_SESSION}`;
    const rejected = events.find((e) => e.kind === 'final' && e.call_id === ninthId);
    expect(expectErrCode(rejected)).toBe('execution_exception');
    if (rejected?.kind === 'final' && rejected.result.kind === 'err') {
      expect(rejected.result.message).toContain('concurrent tool cap exceeded');
    }
  });
});
