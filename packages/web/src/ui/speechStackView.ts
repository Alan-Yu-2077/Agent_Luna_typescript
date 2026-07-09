import type { BubbleView, ChipKind, HistoryTurnView } from '../bubbles';

// v0.25.0 (Initiative 18): the beside-model speech-bubble stack — Luna's replies as timed bubbles
// beside the Live2D model. A `BubbleView` fed by the SAME controller-driven finalize() calls the
// chat window consumes (via RouterBubbleView), so no controller/protocol change. Each reply lives
// ~ttlMs then gently fades; an overflow cap fast-fades the oldest; barge-in clears the stack.
// open/append/chip/setThinking/renderHistory are intentional no-ops — the stack shows only
// completed spoken replies (the window view keeps the full log + streaming + chips).
//
// Design review (2026-07-04): each bubble pops on a RANDOM side of her head — left OR right — so it
// feels alive instead of a fixed column. Two head-anchored zones (left/right of --luna-head-x); the
// bubble is routed to a random one and stacks upward within it. Works in every mode (windowed / pet /
// web) because it anchors to the head vars the sink always publishes. Newest overall carries `.latest`
// (the comic tail, which points toward her — right on a left-side bubble, left on a right-side one).

// Injected so the TTL is deterministic in tests. Returns a cancel fn.
export type StackScheduler = (fn: () => void, ms: number) => () => void;
const realScheduler: StackScheduler = (fn, ms) => {
  const h = setTimeout(fn, ms);
  return () => clearTimeout(h);
};

export type SpeechStackOptions = {
  ttlMs?: number; // a bubble's life before it fades (default 10s — the owner's "~10s")
  fadeMs?: number; // the fade-out transition before DOM removal (must match the CSS)
  maxVisible?: number; // overflow cap — the oldest fast-fades past this
  schedule?: StackScheduler;
  rng?: () => number; // injected for deterministic tests (drives the random side + vertical jitter)
};

type StackBubble = { el: HTMLElement; cancel: (() => void) | null };

export class SpeechStackView implements BubbleView {
  private readonly leftZone: HTMLElement;
  private readonly rightZone: HTMLElement;
  private readonly live: StackBubble[] = []; // oldest → newest (across BOTH zones); newest is `.latest`
  private readonly ttlMs: number;
  private readonly fadeMs: number;
  private readonly maxVisible: number;
  private readonly schedule: StackScheduler;
  private readonly rng: () => number;

  constructor(host: HTMLElement, opts: SpeechStackOptions = {}) {
    this.ttlMs = opts.ttlMs ?? 10_000;
    this.fadeMs = opts.fadeMs ?? 600;
    this.maxVisible = opts.maxVisible ?? 4;
    this.schedule = opts.schedule ?? realScheduler;
    this.rng = opts.rng ?? Math.random;
    const doc = host.ownerDocument;
    const outer = doc.createElement('div');
    outer.className = 'speech-stack';
    this.leftZone = doc.createElement('div');
    this.leftZone.className = 'speech-zone left';
    this.rightZone = doc.createElement('div');
    this.rightZone.className = 'speech-zone right';
    outer.appendChild(this.leftZone);
    outer.appendChild(this.rightZone);
    host.appendChild(outer);
  }

  // A completed reply → a new bubble on a RANDOM side, stacking upward in that zone. The newest
  // carries `.latest` (the comic tail); the previous newest loses it AT THIS MOMENT so the CSS
  // transition animates its tail away as it becomes history.
  finalize(_id: string, text: string): void {
    const t = text.trim();
    if (!t) return;
    this.live[this.live.length - 1]?.el.classList.remove('latest');
    const right = this.rng() < 0.5;
    const zone = right ? this.rightZone : this.leftZone;
    const el = zone.ownerDocument.createElement('div');
    el.className = `speech-bubble latest side-${right ? 'right' : 'left'}`;
    el.textContent = t;
    el.style.marginTop = `${Math.round(2 + this.rng() * 8)}px`; // a little vertical 漫画感 stagger
    zone.appendChild(el);
    const bubble: StackBubble = { el, cancel: null };
    this.live.push(bubble);
    bubble.cancel = this.schedule(() => this.fadeOut(bubble), this.ttlMs);
    while (this.live.length > this.maxVisible) this.fadeOut(this.live[0]!);
  }

  // Restart the newest bubble's life from now — wired to audio speech-begin so the ~10s aligns with
  // when Luna actually says it (playback is serialized, so emit-time and speak-time can differ).
  noteSpeechStart(): void {
    const newest = this.live[this.live.length - 1];
    if (!newest) return;
    newest.cancel?.();
    newest.cancel = this.schedule(() => this.fadeOut(newest), this.ttlMs);
  }

  // Barge-in / a new user turn: clear the stack promptly (the window view keeps the history).
  clearAll(): void {
    for (const b of [...this.live]) this.fadeOut(b);
  }

  private fadeOut(b: StackBubble): void {
    const i = this.live.indexOf(b);
    if (i < 0) return; // already fading/removed
    this.live.splice(i, 1);
    b.cancel?.();
    b.cancel = null;
    b.el.classList.remove('latest'); // a departing bubble drops its tail too
    b.el.classList.add('fading');
    this.schedule(() => b.el.remove(), this.fadeMs);
  }

  // ── BubbleView no-ops: the stack shows only finalized replies (the window view owns the rest) ──
  open(_id: string): void {}
  append(_id: string, _text: string): void {}
  discard(_id: string): void {}
  chip(_kind: ChipKind, _text: string, _href?: string): void {}
  setThinking(_on: boolean): void {}
  renderHistory(_turns: ReadonlyArray<HistoryTurnView>): void {}
}
