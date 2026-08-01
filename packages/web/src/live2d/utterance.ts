import type { Pose } from './faceData';

// v0.43.13 — what the sentence is doing, from its final punctuation.
//
// v0.43.12 reads the audio and gets "where the stresses are". This reads the TEXT and gets "what
// kind of sentence that was" — a question, an exclamation, a trailing-off. Two independent signals,
// deliberately: the envelope carries no pitch, so a rising question intonation is invisible to it,
// and punctuation is the honest approximation available without an F0 tracker or an NLU pass.
//
// Both feed the same pulse layer. This module adds no mechanism at all — only a mapping.

export type GestureId = 'question' | 'exclaim' | 'trailOff' | 'lilt';

export type UtteranceGesture = {
  id: GestureId;
  // `start` fires on the audio's onStart (emphasis belongs across the whole sentence); `end` fires
  // when playback resolves (a question's tilt belongs in the pause AFTER it, where the rise is).
  when: 'start' | 'end';
  pose: Pose;
  durationMs: number;
};

// Only the lateral channels flip when a gesture repeats. Mirroring a brow lift would turn an
// emphasis into a frown — the alternation exists so three questions in a row do not look like a
// stuck animation, not to invert the expression's meaning.
const MIRROR_KEYS = new Set<keyof Pose>(['headRoll', 'headYaw', 'gazeX']);

const GESTURES: Record<GestureId, UtteranceGesture> = {
  question: { id: 'question', when: 'end', pose: { headRoll: 4.5, browLY: 0.06, browRY: 0.06 }, durationMs: 700 },
  exclaim: { id: 'exclaim', when: 'start', pose: { browLY: 0.08, browRY: 0.08, bodyLift: 0.6 }, durationMs: 500 },
  trailOff: { id: 'trailOff', when: 'end', pose: { gazeX: 0.2, headYaw: 2 }, durationMs: 900 },
  lilt: { id: 'lilt', when: 'start', pose: { headRoll: 2.5 }, durationMs: 600 },
};

// Closing quotes and brackets sit AFTER the punctuation that matters — `他说"真的吗？"` ends in a
// quote mark, and the sentence is still a question.
const TRAILING_WRAPPERS = /[\s"'”’」』）)\]】》>]+$/u;

export function classifyUtterance(text: string): UtteranceGesture | null {
  const trimmed = text.replace(TRAILING_WRAPPERS, '');
  if (trimmed === '') return null;
  // Ellipsis first: `。。。` and `...` both END in a character that means nothing on its own, and
  // `…？` should read as the question it ends with, so the ellipsis test is anchored, not a search.
  if (/(…|\.{3,}|。{3,})$/u.test(trimmed)) return GESTURES.trailOff;
  const last = trimmed[trimmed.length - 1];
  if (last === '？' || last === '?') return GESTURES.question;
  if (last === '！' || last === '!') return GESTURES.exclaim;
  if (last === '～' || last === '~') return GESTURES.lilt;
  return null;
}

function mirror(pose: Pose): Pose {
  const out: Pose = {};
  for (const [key, value] of Object.entries(pose) as Array<[keyof Pose, number]>) {
    out[key] = MIRROR_KEYS.has(key) ? -value : value;
  }
  return out;
}

// Stateful only in the direction it tilts, and only across CONSECUTIVE identical gestures. Same
// shape as `AccentDetector`: the caller owns one per conversation and the class owns the memory.
export class UtteranceGestures {
  private lastId: GestureId | null = null;
  private sign = 1;

  next(text: string): UtteranceGesture | null {
    const base = classifyUtterance(text);
    if (!base) {
      this.lastId = null;
      this.sign = 1;
      return null;
    }
    this.sign = base.id === this.lastId ? -this.sign : 1;
    this.lastId = base.id;
    return this.sign === 1 ? base : { ...base, pose: mirror(base.pose) };
  }
}
