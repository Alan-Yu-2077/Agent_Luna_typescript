import type { ExpressionKey } from '@luna/protocol';
import type { EmotionId } from './faceData';

// The bridge our wire contract needs: Python's LLM emitted a Live2D `emotion_id`
// directly, but our MessageDelivery only carries the 15 `expression` affects + a
// 0–1 `emotion` intensity. So the affect → emotion mapping lives here (frontend),
// behind the Live2DSink. Easily tunable; `steady_presence` = baseline (no emotion).
//
// v0.43.2 — the table used to be 15 affects → 10 clips, and the collapses were doing real damage:
// `alert_surprise` was performed as mild curiosity, `gentle_concern` as generic warmth, and FOUR
// hand-authored clips (`fakeFierce`, `embarrassed`, `poutyAnnoyed`, `disappointed`) could never be
// reached at all — the most distinctive poses in the set, dead on the shelf. Hence the branch: the
// same affect at low and high intensity is often two genuinely different faces (guarded → leans back;
// very guarded → bristles), and the intensity is already on the wire beside the affect. All 14 clips
// are now reachable, and it costs no protocol change.
type EmotionChoice = EmotionId | null | { low: EmotionId; high: EmotionId };

// Above this, an affect performs its escalated form. Deliberately high: most turns should read as the
// ordinary face, with the intense one reserved for when the model actually leaned on the intensity.
// Exported since v0.43.7: the workbench draws this as a tick mark on its intensity slider, so the
// mark and the branch cannot drift apart.
export const HIGH_INTENSITY = 0.7;

export const AFFECT_TO_EMOTION: Record<ExpressionKey, EmotionChoice> = {
  curious_attention: 'curious',
  // Concern is warmth that has noticed something wrong; pushed hard it becomes visible dismay.
  gentle_concern: { low: 'tender', high: 'disappointed' },
  // Re-opening is a lean-in first, warmth once it lands.
  open_reengagement: { low: 'curious', high: 'tender' },
  playful_brightness: 'playful',
  focused_engagement: 'focused',
  steady_presence: null,
  soft_warmth: 'tender',
  listening_attention: 'focused',
  // KNOWN GAP: there is no surprise clip in the set — no wide-eyed, open-mouthed pose exists to map
  // onto. `curious` (asymmetric brow raise + the `headLiftAlert` action) is the nearest thing she can
  // actually perform. Authoring a real one is a later version's job, not a mapping fix.
  alert_surprise: 'curious',
  bright_delight: 'adorable',
  amused_smirk: 'smug',
  shy_softness: 'shy',
  // Awkward: a light "…anyway" versus properly flustered.
  awkward_lightness: { low: 'awkwardV2', high: 'embarrassed' },
  // Guarded: leaning back and reading you, versus puffing up defensively.
  guarded_distance: { low: 'skeptical', high: 'fakeFierce' },
  // Annoyed: a flat look, versus the full cheek-puffed sulk.
  annoyed_resistance: { low: 'annoyed', high: 'poutyAnnoyed' },
};

// `intensity` is the wire's OPTIONAL `emotion` field, passed through undefined-and-all. Omitted means
// the model did not ask for a strength, so it must not escalate — the frontend's own 0.95 default for
// pose strength is a rendering choice, not a statement about how strongly she felt it, and reusing it
// here would put every single message into the intense branch.
export function affectToEmotion(key: ExpressionKey, intensity?: number): EmotionId | null {
  const choice = AFFECT_TO_EMOTION[key];
  if (choice === null || typeof choice === 'string') return choice;
  return (intensity ?? 0) >= HIGH_INTENSITY ? choice.high : choice.low;
}

// Every clip this table can reach — used by the coverage test that keeps hand-authored poses from
// silently falling off the shelf again.
export function reachableEmotions(): Set<EmotionId> {
  const out = new Set<EmotionId>();
  for (const choice of Object.values(AFFECT_TO_EMOTION)) {
    if (choice === null) continue;
    if (typeof choice === 'string') out.add(choice);
    else { out.add(choice.low); out.add(choice.high); }
  }
  return out;
}
