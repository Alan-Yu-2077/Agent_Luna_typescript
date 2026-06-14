import type { ExpressionKey } from '@luna/protocol';

// The mood pip's affect → emoji + short Chinese label (the 15 ExpressionKeys).
export const MOOD: Record<ExpressionKey, { emoji: string; label: string }> = {
  curious_attention: { emoji: '👀', label: '好奇' },
  gentle_concern: { emoji: '🥺', label: '关切' },
  open_reengagement: { emoji: '🙂', label: '回应' },
  playful_brightness: { emoji: '😜', label: '俏皮' },
  focused_engagement: { emoji: '🧐', label: '专注' },
  steady_presence: { emoji: '😌', label: '平静' },
  soft_warmth: { emoji: '🥰', label: '温柔' },
  listening_attention: { emoji: '👂', label: '倾听' },
  alert_surprise: { emoji: '😮', label: '惊讶' },
  bright_delight: { emoji: '✨', label: '雀跃' },
  amused_smirk: { emoji: '😏', label: '促狭' },
  shy_softness: { emoji: '😳', label: '害羞' },
  awkward_lightness: { emoji: '😅', label: '尴尬' },
  guarded_distance: { emoji: '😐', label: '戒备' },
  annoyed_resistance: { emoji: '😤', label: '不悦' },
};

export function moodOf(key: ExpressionKey): { emoji: string; label: string } {
  return MOOD[key];
}
