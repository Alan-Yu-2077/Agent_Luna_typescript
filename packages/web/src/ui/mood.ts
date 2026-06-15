import type { ExpressionKey } from '@luna/protocol';

// The mood pip's affect → emoji + short label (the 15 ExpressionKeys).
export const MOOD: Record<ExpressionKey, { emoji: string; label: string }> = {
  curious_attention: { emoji: '👀', label: 'Curious' },
  gentle_concern: { emoji: '🥺', label: 'Concerned' },
  open_reengagement: { emoji: '🙂', label: 'Receptive' },
  playful_brightness: { emoji: '😜', label: 'Playful' },
  focused_engagement: { emoji: '🧐', label: 'Focused' },
  steady_presence: { emoji: '😌', label: 'Calm' },
  soft_warmth: { emoji: '🥰', label: 'Tender' },
  listening_attention: { emoji: '👂', label: 'Listening' },
  alert_surprise: { emoji: '😮', label: 'Surprised' },
  bright_delight: { emoji: '✨', label: 'Delighted' },
  amused_smirk: { emoji: '😏', label: 'Amused' },
  shy_softness: { emoji: '😳', label: 'Shy' },
  awkward_lightness: { emoji: '😅', label: 'Awkward' },
  guarded_distance: { emoji: '😐', label: 'Guarded' },
  annoyed_resistance: { emoji: '😤', label: 'Annoyed' },
};

export function moodOf(key: ExpressionKey): { emoji: string; label: string } {
  return MOOD[key];
}
