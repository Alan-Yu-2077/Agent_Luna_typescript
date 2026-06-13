import { z } from 'zod';

// Live2D expression keys — Python ALLOWED_AFFECTS (15), verbatim. The model
// picks one per message call; the frontend maps it to motion/emotion layers.
export const ExpressionKey = z.enum([
  'curious_attention',
  'gentle_concern',
  'open_reengagement',
  'playful_brightness',
  'focused_engagement',
  'steady_presence',
  'soft_warmth',
  'listening_attention',
  'alert_surprise',
  'bright_delight',
  'amused_smirk',
  'shy_softness',
  'awkward_lightness',
  'guarded_distance',
  'annoyed_resistance',
]);
export type ExpressionKey = z.infer<typeof ExpressionKey>;

// Opaque TTS passthrough — the backend computes nothing here (LD #9); the
// frontend/TTS layer interprets values per provider.
export const VoiceParams = z.object({
  provider: z.string().optional(),
  voice: z.string().optional(),
});
export type VoiceParams = z.infer<typeof VoiceParams>;

// One paced delivery unit. delay_ms is METADATA — the server never sleeps
// (amendment A2); the consumer paces the reveal.
export const MessageSegment = z.object({
  index: z.number().int().min(0),
  text: z.string(),
  delay_ms: z.number().int().min(0),
});
export type MessageSegment = z.infer<typeof MessageSegment>;

// The tool.finished payload for a successful message call — the delivery
// contract the frontend consumes (dev chat now, Initiative 6 later).
export const MessageDelivery = z.object({
  text: z.string(),
  segments: z.array(MessageSegment),
  expression: ExpressionKey.optional(),
  emotion: z.number().min(0).max(1).optional(),
  voice_params: VoiceParams.optional(),
  is_final: z.boolean(),
});
export type MessageDelivery = z.infer<typeof MessageDelivery>;
