import type { z } from 'zod';
import type { ToolErrorCode, ToolName } from '@luna/protocol';

export type ConcurrencyPolicy = 'safe-parallel' | 'session-serial' | 'global-serial';

export type ToolContext = {
  sessionId: string;
  callId: string;
  abortSignal: AbortSignal;
};

export type InternalEvent<T> =
  | { kind: 'progress'; payload: unknown }
  | { kind: 'ok'; data: T }
  | { kind: 'err'; code: ToolErrorCode; message: string; recoverable: boolean };

// `any` in summarize/execute is required for bivariance: ToolSpec<I, O> is generic and
// invariant on I/O, so storing it in a heterogeneous Record<ToolName, Tool> needs the
// callable positions to use `any` to make assignment work. Type safety for tool authors
// is preserved via the ToolSpec<I, O> generic in defineTool; the dispatcher always
// validates input/output via Zod safeParse at runtime regardless.
export interface Tool {
  name: ToolName;
  description: string;
  input: z.ZodTypeAny;
  output: z.ZodTypeAny;
  concurrency: ConcurrencyPolicy;
  timeoutMs: number;
  summarize: (out: any) => string;
  execute: (
    input: any,
    ctx: ToolContext,
  ) => AsyncGenerator<InternalEvent<any>, void, unknown>;
}

export interface ToolSpec<I extends z.ZodTypeAny, O extends z.ZodTypeAny> {
  name: ToolName;
  description: string;
  input: I;
  output: O;
  concurrency: ConcurrencyPolicy;
  timeoutMs: number;
  summarize: (out: z.infer<O>) => string;
  execute: (
    input: z.infer<I>,
    ctx: ToolContext,
  ) => AsyncGenerator<InternalEvent<z.infer<O>>, void, unknown>;
}

export function defineTool<I extends z.ZodTypeAny, O extends z.ZodTypeAny>(
  spec: ToolSpec<I, O>,
): Tool {
  return spec;
}
