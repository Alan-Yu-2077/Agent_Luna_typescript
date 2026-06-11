import { z } from 'zod';

export const PingEvent = z.object({
  type: z.literal('ping'),
  seq: z.number().int().nonnegative(),
});

export const ClientEvent = z.discriminatedUnion('type', [PingEvent]);
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

export const ServerEvent = z.discriminatedUnion('type', [PongEvent, ErrorEvent]);
export type ServerEvent = z.infer<typeof ServerEvent>;
