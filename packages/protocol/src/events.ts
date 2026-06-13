import { z } from 'zod';
import { ToolName, ToolResult } from './tools';

export const PingEvent = z.object({
  type: z.literal('ping'),
  seq: z.number().int().nonnegative(),
});

export const DevDispatchToolEvent = z.object({
  type: z.literal('dev.dispatch_tool'),
  call_id: z.string(),
  tool_name: ToolName,
  input: z.unknown(),
});

export const ChatSendEvent = z.object({
  type: z.literal('chat.send'),
  turn_id: z.string().optional(),
  text: z.string().min(1),
});

export const DreamEnterEvent = z.object({
  type: z.literal('dream.enter'),
});

export const DreamWakeEvent = z.object({
  type: z.literal('dream.wake'),
});

// Manual trigger for a proactive turn (Initiative 5, v0.10.0). Autonomous
// firing comes from the server-side scheduler at v0.10.3.
export const ProactiveFireEvent = z.object({
  type: z.literal('proactive.fire'),
});

export const ClientEvent = z.discriminatedUnion('type', [
  PingEvent,
  DevDispatchToolEvent,
  ChatSendEvent,
  DreamEnterEvent,
  DreamWakeEvent,
  ProactiveFireEvent,
]);
export type ClientEvent = z.infer<typeof ClientEvent>;

export const PongEvent = z.object({
  type: z.literal('pong'),
  seq: z.number().int().nonnegative(),
  server_time_ms: z.number().int().nonnegative(),
});

export const ErrorEvent = z.object({
  type: z.literal('error'),
  code: z.string(),
  message: z.string(),
});

export const ToolStartedEvent = z.object({
  type: z.literal('tool.started'),
  call_id: z.string(),
  tool_name: ToolName,
  input: z.unknown(),
});

export const ToolProgressEvent = z.object({
  type: z.literal('tool.progress'),
  call_id: z.string(),
  // present since v0.6.2 — lets consumers filter (the message-streaming
  // contract Initiative 6 subscribes to is tool.progress{tool_name:'message'})
  tool_name: ToolName.optional(),
  payload: z.unknown(),
});

export const ToolFinishedEvent = z.object({
  type: z.literal('tool.finished'),
  call_id: z.string(),
  result: ToolResult,
});

export const TurnStartedEvent = z.object({
  type: z.literal('turn.started'),
  turn_id: z.string(),
});

export const ReplyTokenEvent = z.object({
  type: z.literal('reply.token'),
  turn_id: z.string(),
  text: z.string(),
});

export const FinishReason = z.enum([
  'end_turn',
  'max_iterations',
  'max_tokens',
  'refusal',
  'error',
]);
export type FinishReason = z.infer<typeof FinishReason>;

export const TurnResultEvent = z.object({
  type: z.literal('turn.result'),
  turn_id: z.string(),
  text: z.string(),
  finish_reason: FinishReason,
  usage: z.object({
    input_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative(),
  }),
});

export const DreamStepStatus = z.enum(['ok', 'skipped', 'failed']);
export type DreamStepStatus = z.infer<typeof DreamStepStatus>;

export const DreamStatusEvent = z.object({
  type: z.literal('dream.status'),
  is_dreaming: z.boolean(),
  current_step: z.string().nullable(),
  last_dream_ms: z.number().int().nullable(),
});

export const DreamStepEvent = z.object({
  type: z.literal('dream.step'),
  step: z.string(),
  status: DreamStepStatus,
  detail: z.string(),
});

// Proactive cycle markers (Initiative 5, v0.10.0). `spoke=false` = a silent
// proactive turn (she acted via tools but sent no message) — the core new
// capability of proactive agency.
export const ProactiveStartedEvent = z.object({
  type: z.literal('proactive.started'),
  cycle_id: z.string(),
});

export const ProactiveFinishedEvent = z.object({
  type: z.literal('proactive.finished'),
  cycle_id: z.string(),
  spoke: z.boolean(),
});

export const ServerEvent = z.discriminatedUnion('type', [
  PongEvent,
  ErrorEvent,
  ToolStartedEvent,
  ToolProgressEvent,
  ToolFinishedEvent,
  TurnStartedEvent,
  ReplyTokenEvent,
  TurnResultEvent,
  DreamStatusEvent,
  DreamStepEvent,
  ProactiveStartedEvent,
  ProactiveFinishedEvent,
]);
export type ServerEvent = z.infer<typeof ServerEvent>;
