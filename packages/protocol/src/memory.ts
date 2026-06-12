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

export const L3Category = z.enum([
  'core_facts',
  'preferences',
  'key_moments',
  'active_threads',
  'project_context',
]);
export type L3Category = z.infer<typeof L3Category>;

export const L3Confidence = z.enum(['high', 'medium', 'low']);
export type L3Confidence = z.infer<typeof L3Confidence>;

export const L3Fact = z.object({
  id: z.string(),
  category: L3Category,
  text: z.string().min(1),
  confidence: L3Confidence.nullable(),
  created_ms: z.number().int().nonnegative(),
  expires_ms: z.number().int().nullable(),
  deleted_ms: z.number().int().nullable(),
});
export type L3Fact = z.infer<typeof L3Fact>;

export const CoreMemory = z.object({
  self_state: z.string(),
  relationship_status: z.string(),
  updated_ms: z.number().int().nonnegative(),
});
export type CoreMemory = z.infer<typeof CoreMemory>;
