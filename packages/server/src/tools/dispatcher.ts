import type { ToolCall, ToolEvent } from '@luna/protocol';
import type { InternalEvent, Tool } from './defineTool';
import { Mutex } from './mutex';
import { mergeAsync } from './mergeAsync';
import type { ToolRegistry } from './registry';

export const MAX_CONCURRENT_TOOLS_PER_SESSION = 8;

const globalMutex = new Mutex();

export type DispatchContext = {
  sessionId: string;
  sessionMutex: Mutex;
};

export async function* dispatchToolCalls(
  calls: ToolCall[],
  ctx: DispatchContext,
  registry: ToolRegistry,
): AsyncGenerator<ToolEvent, void, unknown> {
  const overflow = calls.slice(MAX_CONCURRENT_TOOLS_PER_SESSION);
  const accepted = calls.slice(0, MAX_CONCURRENT_TOOLS_PER_SESSION);

  for (const call of overflow) {
    // recoverable: the model can simply re-issue the dropped calls next round
    yield finalErr(call, 'execution_exception', 'concurrent tool cap exceeded', true);
  }

  const safeParallel: ToolCall[] = [];
  const sessionSerial: ToolCall[] = [];
  const globalSerial: ToolCall[] = [];

  for (const call of accepted) {
    const tool = (registry as Record<string, Tool | undefined>)[call.tool_name];
    if (!tool) {
      yield finalErr(call, 'tool_not_found', `tool not found: ${call.tool_name}`, false);
      continue;
    }
    switch (tool.concurrency) {
      case 'safe-parallel':
        safeParallel.push(call);
        break;
      case 'session-serial':
        sessionSerial.push(call);
        break;
      case 'global-serial':
        globalSerial.push(call);
        break;
    }
  }

  const streams: AsyncIterable<ToolEvent>[] = [];
  for (const call of safeParallel) {
    streams.push(runOne(call, ctx, registry));
  }
  if (sessionSerial.length > 0) {
    streams.push(runSerial(sessionSerial, ctx.sessionMutex, ctx, registry));
  }
  if (globalSerial.length > 0) {
    streams.push(runSerial(globalSerial, globalMutex, ctx, registry));
  }

  yield* mergeAsync(streams);
}

async function* runSerial(
  calls: ToolCall[],
  mutex: Mutex,
  ctx: DispatchContext,
  registry: ToolRegistry,
): AsyncGenerator<ToolEvent, void, unknown> {
  for (const call of calls) {
    let release: () => void;
    try {
      release = await mutex.acquire();
    } catch {
      yield finalErr(call, 'aborted', 'lock acquisition aborted', false);
      continue;
    }
    try {
      yield* runOne(call, ctx, registry);
    } finally {
      release();
    }
  }
}

async function* runOne(
  call: ToolCall,
  ctx: DispatchContext,
  registry: ToolRegistry,
): AsyncGenerator<ToolEvent, void, unknown> {
  const tool = (registry as Record<string, Tool | undefined>)[call.tool_name];
  if (!tool) {
    yield finalErr(call, 'tool_not_found', `tool not found: ${call.tool_name}`, false);
    return;
  }

  const inputParse = tool.input.safeParse(call.input);
  if (!inputParse.success) {
    yield finalErr(call, 'validation_failed', `input: ${inputParse.error.message}`, true);
    return;
  }

  yield {
    kind: 'started',
    tool_name: call.tool_name,
    call_id: call.call_id,
    input: inputParse.data,
  };

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort('timeout'), tool.timeoutMs);

  const iter = tool.execute(inputParse.data, {
    sessionId: ctx.sessionId,
    callId: call.call_id,
    abortSignal: abortController.signal,
  });

  let aborted = false;

  try {
    while (true) {
      const abortPromise = new Promise<{ aborted: true }>((resolve) => {
        if (abortController.signal.aborted) {
          resolve({ aborted: true });
        } else {
          abortController.signal.addEventListener('abort', () => resolve({ aborted: true }), {
            once: true,
          });
        }
      });

      const winner = await Promise.race([
        iter.next().then(
          (r): { result: IteratorResult<InternalEvent<unknown>> } => ({ result: r }),
          (e: unknown): { thrown: unknown } => ({ thrown: e }),
        ),
        abortPromise,
      ]);

      if ('aborted' in winner) {
        aborted = true;
        yield finalErr(call, 'timeout', `tool timed out after ${tool.timeoutMs}ms`, false);
        return;
      }

      if ('thrown' in winner) {
        const message =
          winner.thrown instanceof Error ? winner.thrown.message : String(winner.thrown);
        yield finalErr(
          call,
          abortController.signal.aborted ? 'timeout' : 'execution_exception',
          message,
          false,
        );
        return;
      }

      if (winner.result.done) {
        yield finalErr(call, 'execution_exception', 'tool generator ended without final event', false);
        return;
      }

      const internal = winner.result.value;

      if (internal.kind === 'progress') {
        yield {
          kind: 'progress',
          tool_name: call.tool_name,
          call_id: call.call_id,
          payload: internal.payload,
        };
        continue;
      }

      if (internal.kind === 'err') {
        yield {
          kind: 'final',
          tool_name: call.tool_name,
          call_id: call.call_id,
          result: {
            kind: 'err',
            code: internal.code,
            message: internal.message,
            recoverable: internal.recoverable,
          },
        };
        return;
      }

      const outputParse = tool.output.safeParse(internal.data);
      if (!outputParse.success) {
        yield finalErr(call, 'validation_failed', 'tool output schema mismatch', false);
        return;
      }

      const summary = tool.summarize(outputParse.data);
      yield {
        kind: 'final',
        tool_name: call.tool_name,
        call_id: call.call_id,
        result: {
          kind: 'ok',
          data: outputParse.data ?? null,
          summary,
        },
      };
      return;
    }
  } finally {
    clearTimeout(timeoutId);
    const cleanup = (async () => {
      try {
        await iter.return?.(undefined);
      } catch {
        /* swallow */
      }
    })();
    if (aborted) {
      await Promise.race([cleanup, new Promise<void>((r) => setTimeout(r, 100))]);
    } else {
      await cleanup;
    }
  }
}

function finalErr(
  call: ToolCall,
  code: 'tool_not_found' | 'validation_failed' | 'execution_exception' | 'timeout' | 'aborted',
  message: string,
  recoverable: boolean,
): ToolEvent {
  return {
    kind: 'final',
    tool_name: call.tool_name,
    call_id: call.call_id,
    result: { kind: 'err', code, message, recoverable },
  };
}
