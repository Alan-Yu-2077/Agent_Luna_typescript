import type { ExpressionKey } from '@luna/protocol';
import type { EmotionId } from './faceData';

// The bridge our wire contract needs: Python's LLM emitted a Live2D `emotion_id`
// directly, but our MessageDelivery only carries the 15 `expression` affects + a
// 0–1 `emotion` intensity. So the affect → emotion mapping lives here (frontend),
// behind the Live2DSink. Easily tunable; `steady_presence` = baseline (no emotion).
export const AFFECT_TO_EMOTION: Record<ExpressionKey, EmotionId | null> = {
  curious_attention: 'curious',
  gentle_concern: 'tender',
  open_reengagement: 'tender',
  playful_brightness: 'playful',
  focused_engagement: 'focused',
  steady_presence: null,
  soft_warmth: 'tender',
  listening_attention: 'curious',
  alert_surprise: 'curious',
  bright_delight: 'adorable',
  amused_smirk: 'smug',
  shy_softness: 'shy',
  awkward_lightness: 'awkwardV2',
  guarded_distance: 'skeptical',
  annoyed_resistance: 'annoyed',
};

export function affectToEmotion(key: ExpressionKey): EmotionId | null {
  return AFFECT_TO_EMOTION[key];
}
