import { z } from 'zod';

export const ToolName = z.enum([
  'time_now',
  'read_file',
  'remember',
  'enter_dream',
  'message',
  'recall',
  'list_files',
  'grep',
]);
export type ToolName = z.infer<typeof ToolName>;

export const ToolErrorCode = z.enum([
  'tool_not_found',
  'validation_failed',
  'execution_exception',
  'timeout',
  'aborted',
]);
export type ToolErrorCode = z.infer<typeof ToolErrorCode>;

export const ToolResultOk = z.object({
  kind: z.literal('ok'),
  data: z.unknown(),
  summary: z.string(),
});

export const ToolResultErr = z.object({
  kind: z.literal('err'),
  code: ToolErrorCode,
  message: z.string(),
  recoverable: z.boolean(),
});

export const ToolResult = z.discriminatedUnion('kind', [ToolResultOk, ToolResultErr]);
export type ToolResult = z.infer<typeof ToolResult>;

export const ToolEventStarted = z.object({
  kind: z.literal('started'),
  tool_name: z.string(),
  call_id: z.string(),
  input: z.unknown(),
});

export const ToolEventProgress = z.object({
  kind: z.literal('progress'),
  tool_name: z.string(),
  call_id: z.string(),
  payload: z.unknown(),
});

export const ToolEventFinal = z.object({
  kind: z.literal('final'),
  tool_name: z.string(),
  call_id: z.string(),
  result: ToolResult,
});

export const ToolEvent = z.discriminatedUnion('kind', [
  ToolEventStarted,
  ToolEventProgress,
  ToolEventFinal,
]);
export type ToolEvent = z.infer<typeof ToolEvent>;

export const ToolCall = z.object({
  call_id: z.string(),
  tool_name: ToolName,
  input: z.unknown(),
});
export type ToolCall = z.infer<typeof ToolCall>;
