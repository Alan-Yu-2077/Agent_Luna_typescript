import type { Session } from '../turn/session';
import { afterANightOpening } from '../turn/temporalContext';
import { lastInteractionMs, type ProactiveIntent } from './proactiveTurn';
import { type Cadence, isSlotConsumed, scheduledSlots } from './cadence';

// v0.22.1 (Initiative 15): the deterministic proactive detector registry — cheap, pure,
// LLM-free triggers evaluated each tick. First match wins; the matched trigger's seed is
// appended to the proactive turn's framing, and the turn itself decides whether to speak
// (drafting-as-decision). This replaces the old per-tick LLM wake-gate's "is there a
// reason?" judgment with concrete, code-detected reasons.

export type DetectorCtx = {
  session: Session;
  cadence: Cadence;
  nowMs: number;
  nowHour: number;
};

export type ProactiveTrigger = {
  intent: ProactiveIntent;
  seed: string;
  // identifies the trigger for per-slot/day debouncing (e.g. 'after_night', 'slot:11').
  debounceKey: string;
};

export type ProactiveDetector = {
  name: string;
  detect: (ctx: DetectorCtx) => ProactiveTrigger | null;
};

const AFTER_NIGHT_SEED =
  '(Context: this is the first time you are seeing Alan again after a night — or a longer ' +
  'absence. A warm, natural hello, or quietly picking up a real thread from before, would fit ' +
  'here — only if you genuinely have something to bring; never a status or check-in question, ' +
  'and staying silent is completely fine.)';

const SCHEDULED_SEED =
  "(Context: it's around your usual time to check in. If something is genuinely on your mind — a " +
  'thought, a small update, a thread worth picking back up — you might share it; if nothing is, ' +
  'let this moment pass in silence. Never open with a status or check-in question.)';

// First contact after a night (or a longer absence) — wraps the existing
// afterANightOpening (gap >= 6h + morning daypart + crosses a day). Self-debounces:
// once she greets, the proactive turn persists to L2, so lastInteractionMs is recent and
// the gap drops below 6h on the next tick.
const afterNight: ProactiveDetector = {
  name: 'after_night',
  detect: (ctx) =>
    afterANightOpening(ctx.nowMs, lastInteractionMs(ctx.session))
      ? { intent: 'spontaneous', seed: AFTER_NIGHT_SEED, debounceKey: 'after_night' }
      : null,
};

// A scheduled daily opening — a guaranteed speaking floor independent of any content
// trigger. Fires at most once per configured local hour per day (the per-day slot
// bitmask, marked consumed by the scheduler after the turn runs).
const scheduledWindow: ProactiveDetector = {
  name: 'scheduled_window',
  detect: (ctx) => {
    if (!scheduledSlots().includes(ctx.nowHour)) return null;
    if (isSlotConsumed(ctx.cadence, ctx.nowHour, ctx.nowMs)) return null;
    return { intent: 'spontaneous', seed: SCHEDULED_SEED, debounceKey: `slot:${ctx.nowHour}` };
  },
};

// Ordered by priority — after-a-night beats a scheduled slot if both land at once.
const REGISTRY: ProactiveDetector[] = [afterNight, scheduledWindow];

export function evaluateDetectors(ctx: DetectorCtx): ProactiveTrigger | null {
  for (const d of REGISTRY) {
    const hit = d.detect(ctx);
    if (hit) return hit;
  }
  return null;
}
