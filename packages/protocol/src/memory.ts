import { z } from 'zod';

export const L2Turn = z.object({
  session_id: z.string(),
  turn_id: z.string(),
  t_ms: z.number().int().nonnegative(),
  user_text: z.string(),
  assistant_text: z.string(),
  raw_json: z.string(),
});
export type L2Turn = z.infer<typeof L2Turn>;

export const SessionRow = z.object({
  id: z.string(),
  turn_seq: z.number().int().nonnegative(),
  history_json: z.string(),
  updated_ms: z.number().int().nonnegative(),
});
export type SessionRow = z.infer<typeof SessionRow>;
