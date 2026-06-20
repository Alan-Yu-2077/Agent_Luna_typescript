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

// S5 (v0.16.0): cap user input. 8000 chars is far above the 280-char humanity
// reply cap and any realistic single message, but rejects abusive/accidental
// oversized payloads (which become large, expensive LLM requests) at the schema
// boundary — enforced alongside the socket-level maxPayloadLength.
export const CHAT_SEND_MAX_CHARS = 8000;

export const ChatSendEvent = z.object({
  type: z.literal('chat.send'),
  turn_id: z.string().optional(),
  text: z.string().min(1).max(CHAT_SEND_MAX_CHARS),
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

// A web source Luna used this turn (Initiative 11, v0.18.2) — gathered from
// web_search result urls + web_fetch final_url. Rides turn.result so the
// frontend can render source cards and L2 keeps them (she cites across turns).
export const Citation = z.object({
  // http(s) only — these urls are untrusted web-tool output that rides to the
  // frontend as a clickable href. A scheme refine (NOT z.string().url(), which is
  // STRICTER than the WHATWG URL the renderer's safeHttpHref uses — a url the
  // renderer accepts but .url() rejects would throw in outbound and drop the whole
  // turn.result). Citation urls always originate http(s) (web_fetch's resolved
  // final_url / web_search results), so this never rejects a real one.
  url: z.string().refine((u) => /^https?:\/\//i.test(u), 'citation url must be http(s)'),
  title: z.string(),
});
export type Citation = z.infer<typeof Citation>;

export const TurnResultEvent = z.object({
  type: z.literal('turn.result'),
  turn_id: z.string(),
  text: z.string(),
  finish_reason: FinishReason,
  usage: z.object({
    input_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative(),
  }),
  citations: z.array(Citation).optional(),
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

// Sent once on WS connect: replays the persisted conversation so a refresh
// rehydrates the chat log (Initiative 6 fix). One entry per L2 turn; a proactive
// turn has empty user_text. t_ms is the real turn time so timestamps are honest.
export const HistoryTurn = z.object({
  user_text: z.string(),
  assistant_text: z.string(),
  t_ms: z.number().int().nonnegative(),
});
export type HistoryTurn = z.infer<typeof HistoryTurn>;

export const HistoryEvent = z.object({
  type: z.literal('history'),
  turns: z.array(HistoryTurn),
});

export const ServerEvent = z.discriminatedUnion('type', [
  PongEvent,
  HistoryEvent,
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
