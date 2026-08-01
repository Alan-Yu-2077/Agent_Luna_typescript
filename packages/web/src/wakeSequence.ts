import type { Live2DSink } from './sinks';

// v0.44.1 — she wakes for you. Talk is not a page navigation: the menu fades, the chat fades in,
// and she opens her eyes and lifts her head IN PLACE. The whole sequence is composed from layers
// that already exist — state switch (the 0.6× posture smoothing raises her head slowly on its own),
// the sleeping→neutral handback that returns her eyelids to the built-in blink (she blinks awake),
// a v0.43.8 manual gesture, a v0.43.12 pulse, a light clip to land on. Zero new engine mechanism:
// this file is choreography, and the dividend of everything v0.43.x built.
//
// The model's two motion3 files were checked and rejected (M7): they are a wave and a cry, and both
// loop — nothing in them says "waking".

export type SequenceStep = { at: number; call: (sink: Live2DSink) => void; label: string };

export const WAKE_STEPS: readonly SequenceStep[] = [
  // 0ms — leaving `sleeping` IS the eye handback: the state stops holding the lids shut, the
  // built-in blink takes them back, and her first blink is the blink awake.
  { at: 0, label: 'neutral', call: (s) => s.setState('neutral') },
  { at: 550, label: 'headLiftAlert', call: (s) => s.playAction?.('headLiftAlert') },
  // The "I see you" brow. Rides the speech-performance pulse layer, so it shares that flag —
  // acceptable coupling for a 0.06 lift; not worth a second pulse door on the sink.
  { at: 950, label: 'browLift', call: (s) => s.pulse?.({ browLY: 0.06, browRY: 0.06 }, 500) },
  { at: 1300, label: 'tender', call: (s) => s.triggerEmotion?.('tender') },
];

// The way back down (← Menu): one call, and the layers do the rest — the state bias lowers her
// head at the deliberately slow posture rate and hands the eyelids to `sleeping`'s closed pose.
// 1.2s is how long that settles visibly; the zzz remounts with the menu and fades in on its own.
export const SLEEP_STEPS: readonly SequenceStep[] = [
  { at: 0, label: 'sleeping', call: (s) => s.setState('sleeping') },
];

export const WAKE_TOTAL_MS = 1800;
export const SLEEP_TOTAL_MS = 1200;

type Schedule = (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;

// Injectable scheduler so tests assert the exact order and offsets without waiting on wall clock.
export function runSequence(
  sink: Live2DSink,
  steps: readonly SequenceStep[],
  schedule: Schedule = (fn, ms) => setTimeout(fn, ms),
): { cancel: () => void } {
  const timers: Array<ReturnType<typeof setTimeout>> = [];
  for (const step of steps) {
    if (step.at === 0) step.call(sink);
    else timers.push(schedule(() => step.call(sink), step.at));
  }
  return { cancel: () => timers.forEach((t) => clearTimeout(t)) };
}
