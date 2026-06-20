import { z } from 'zod';

// (v0.20.9: the dead, stale L2Turn + SessionRow wire schemas were removed — they
// had zero consumers and had drifted from the live SQLite shape, where L2 is the
// source of truth and `sessions` carries rolling_summary/window_low_water/proactive_*.
// The server defines its own row types in memory/sessionStore.ts.)

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
