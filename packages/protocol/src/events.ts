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

export const ClientEvent = z.discriminatedUnion('type', [PingEvent, DevDispatchToolEvent]);
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
  payload: z.unknown(),
});

export const ToolFinishedEvent = z.object({
  type: z.literal('tool.finished'),
  call_id: z.string(),
  result: ToolResult,
});

export const ServerEvent = z.discriminatedUnion('type', [
  PongEvent,
  ErrorEvent,
  ToolStartedEvent,
  ToolProgressEvent,
  ToolFinishedEvent,
]);
export type ServerEvent = z.infer<typeof ServerEvent>;
