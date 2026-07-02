import type { BubbleView, ChipKind, HistoryTurnView } from '../bubbles';

// v0.25.0 (Initiative 18): the beside-model speech-bubble stack — Luna's replies as timed bubbles
// next to the Live2D model in collapsed companion mode. A `BubbleView` fed by the SAME
// controller-driven finalize() calls the chat window consumes (via RouterBubbleView), so no
// controller/protocol change. Newest bubble at the bottom (DOM append order in a bottom-anchored
// column); each lives ~ttlMs then gently fades; an overflow cap fast-fades the oldest; barge-in
// clears the stack. open/append/chip/setThinking/renderHistory are intentional no-ops — the stack
// shows only completed spoken replies (the window view keeps the full log + streaming + chips).

// Injected so the TTL is deterministic in tests. Returns a cancel fn.
export type StackScheduler = (fn: () => void, ms: number) => () => void;
const realScheduler: StackScheduler = (fn, ms) => {
  const h = setTimeout(fn, ms);
  return () => clearTimeout(h);
};

export type SpeechStackOptions = {
  ttlMs?: number; // a bubble's life before it fades (default 10s — Alan's "~10s")
  fadeMs?: number; // the fade-out transition before DOM removal (must match the CSS)
  maxVisible?: number; // overflow cap — the oldest fast-fades past this
  schedule?: StackScheduler;
};

type StackBubble = { el: HTMLElement; cancel: (() => void) | null };

export class SpeechStackView implements BubbleView {
  private readonly container: HTMLElement;
  private readonly live: StackBubble[] = []; // oldest → newest; newest is the bottom bubble
  private readonly ttlMs: number;
  private readonly fadeMs: number;
  private readonly maxVisible: number;
  private readonly schedule: StackScheduler;

  constructor(host: HTMLElement, opts: SpeechStackOptions = {}) {
    this.ttlMs = opts.ttlMs ?? 10_000;
    this.fadeMs = opts.fadeMs ?? 600;
    this.maxVisible = opts.maxVisible ?? 4;
    this.schedule = opts.schedule ?? realScheduler;
    const doc = host.ownerDocument;
    this.container = doc.createElement('div');
    this.container.className = 'speech-stack';
    host.appendChild(this.container);
  }

  // A completed reply → a new bubble at the bottom; the older ones sit above it (DOM order).
  finalize(_id: string, text: string): void {
    const t = text.trim();
    if (!t) return;
    const el = this.container.ownerDocument.createElement('div');
    el.className = 'speech-bubble';
    el.textContent = t;
    this.container.appendChild(el);
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
