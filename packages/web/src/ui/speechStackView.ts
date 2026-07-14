import type { BubbleView, ChipKind, HistoryTurnView } from '../bubbles';

// v0.25.0 (Initiative 18): the beside-model speech-bubble stack — Luna's replies as timed bubbles
// beside the Live2D model. A `BubbleView` fed by the SAME controller-driven finalize() calls the
// chat window consumes (via RouterBubbleView), so no controller/protocol change.
//
// v0.36.2 (Initiative 26): her words gain weight. A bubble hangs beside her head while she speaks it,
// then DETACHES and FALLS (physics) instead of fading in place — it bounces, rests on the floor, can
// be picked up / thrown, and dissolves 30s after coming to rest. The fall is driven by an injected
// `detach` seam (the physics scene); with no seam injected the old fade-in-place lifecycle is kept
// intact (voiceless-no-physics + headless tests).
//
// Each bubble pops on a RANDOM side of her head (two head-anchored zones around --luna-head-x) so it
// feels alive. Newest hanging bubble carries `.latest` (a subtle emphasis; the comic tail was
// removed in v0.36.2). open/append/chip/setThinking/renderHistory are no-ops — the stack shows only
// completed spoken replies (the window view keeps the full log + streaming + chips).

// Injected so the TTL is deterministic in tests. Returns a cancel fn.
export type StackScheduler = (fn: () => void, ms: number) => () => void;
const realScheduler: StackScheduler = (fn, ms) => {
  const h = setTimeout(fn, ms);
  return () => clearTimeout(h);
};

// The physics handle a detached bubble becomes (satisfied by the scene's FallenBubble).
export interface DetachedBubble {
  onRest(cb: () => void): void;
  onGrab(cb: () => void): void;
  remove(): void;
}
// Re-home a hanging bubble element into the falling world at its current position. Returns null if
// physics is unavailable / the element isn't measurable → the caller falls back to a fade.
export type DetachFn = (el: HTMLElement, angle: number) => DetachedBubble | null;

export type SpeechStackOptions = {
  ttlMs?: number; // how long a bubble hangs before it detaches/falls (default 10s)
  fadeMs?: number; // the fade-out transition before DOM removal (must match the CSS)
  maxVisible?: number; // hanging overflow cap — the oldest fast-fades past this
  maxFallen?: number; // resting-pile cap — the oldest fallen fast-dissolves past this
  dissolveMs?: number; // time AT REST before a fallen bubble dissolves (default 10s; a drag re-arms it)
  detach?: DetachFn; // physics seam; absent → old fade-in-place behavior
  schedule?: StackScheduler;
  rng?: () => number; // injected for deterministic tests (side pick, jitter, fall tilt)
};

type Phase = 'hanging' | 'fallen';
type StackBubble = {
  el: HTMLElement;
  cancel: (() => void) | null; // hang TTL
  dissolveCancel: (() => void) | null; // rest→dissolve timer
  phase: Phase;
  fallen: DetachedBubble | null;
};

export class SpeechStackView implements BubbleView {
  private readonly leftZone: HTMLElement;
  private readonly rightZone: HTMLElement;
  private readonly hanging: StackBubble[] = []; // oldest → newest; newest is `.latest`
  private readonly fallen: StackBubble[] = []; // oldest → newest floor objects
  private readonly ttlMs: number;
  private readonly fadeMs: number;
  private readonly maxVisible: number;
  private readonly maxFallen: number;
  private readonly dissolveMs: number;
  private readonly detach: DetachFn | null;
  private readonly schedule: StackScheduler;
  private readonly rng: () => number;

  constructor(host: HTMLElement, opts: SpeechStackOptions = {}) {
    this.ttlMs = opts.ttlMs ?? 10_000;
    this.fadeMs = opts.fadeMs ?? 600;
    this.maxVisible = opts.maxVisible ?? 4;
    this.maxFallen = opts.maxFallen ?? 6;
    this.dissolveMs = opts.dissolveMs ?? 10_000;
    this.detach = opts.detach ?? null;
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

  // A completed reply → a new hanging bubble on a RANDOM side. The newest carries `.latest`; the
  // previous newest loses it now.
  finalize(_id: string, text: string): void {
    const t = text.trim();
    if (!t) return;
    this.hanging[this.hanging.length - 1]?.el.classList.remove('latest');
    const right = this.rng() < 0.5;
    const zone = right ? this.rightZone : this.leftZone;
    const el = zone.ownerDocument.createElement('div');
    el.className = `speech-bubble latest side-${right ? 'right' : 'left'}`;
    el.textContent = t;
    el.style.marginTop = `${Math.round(2 + this.rng() * 8)}px`; // a little vertical 漫画感 stagger
    zone.appendChild(el);
    const bubble: StackBubble = { el, cancel: null, dissolveCancel: null, phase: 'hanging', fallen: null };
    this.hanging.push(bubble);
    bubble.cancel = this.schedule(() => this.detachOrFade(bubble), this.ttlMs);
    while (this.hanging.length > this.maxVisible) this.fadeOut(this.hanging[0]!);
  }

  // Luna actually began speaking this reply → restart the newest hanging bubble's hang timer so its
  // ~10s counts from when she says it (playback is serialized; emit ≠ speak time).
  noteSpeechStart(): void {
    const newest = this.hanging[this.hanging.length - 1];
    if (!newest) return;
    newest.cancel?.();
    newest.cancel = this.schedule(() => this.detachOrFade(newest), this.ttlMs);
  }

  // Luna finished speaking a reply → that bubble's words gain weight and fall. Speech is serialized,
  // so the utterance that just ended is the OLDEST still-hanging bubble.
  noteSpeechEnd(): void {
    const oldest = this.hanging[0];
    if (oldest) this.detachOrFade(oldest);
  }

  // Barge-in / a new user turn: clear HANGING bubbles (they're being spoken over). Fallen bubbles are
  // floor objects now — they persist until they dissolve or are thrown away.
  clearAll(): void {
    for (const b of [...this.hanging]) this.fadeOut(b);
  }

  private detachOrFade(bubble: StackBubble): void {
    const i = this.hanging.indexOf(bubble);
    if (i < 0) return; // already left the hang phase
    const handle = this.detach?.(bubble.el, (this.rng() - 0.5) * 0.35);
    if (!handle) {
      this.fadeOut(bubble); // no physics → old fade-in-place (fadeOut owns the splice + cancel)
      return;
    }
    this.hanging.splice(i, 1);
    bubble.cancel?.();
    bubble.cancel = null;
    bubble.phase = 'fallen';
    bubble.fallen = handle;
    bubble.el.classList.remove('latest');
    bubble.el.classList.add('fallen');
    this.fallen.push(bubble);
    handle.onRest(() => this.armDissolve(bubble));
    handle.onGrab(() => {
      bubble.dissolveCancel?.();
      bubble.dissolveCancel = null;
    });
    while (this.fallen.length > this.maxFallen) this.dissolve(this.fallen[0]!);
  }

  private armDissolve(bubble: StackBubble): void {
    bubble.dissolveCancel?.();
    bubble.dissolveCancel = this.schedule(() => this.dissolve(bubble), this.dissolveMs);
  }

  private dissolve(bubble: StackBubble): void {
    const i = this.fallen.indexOf(bubble);
    if (i < 0) return;
    this.fallen.splice(i, 1);
    bubble.dissolveCancel?.();
    bubble.dissolveCancel = null;
    bubble.el.classList.add('fading');
    this.schedule(() => bubble.fallen?.remove(), this.fadeMs);
  }

  private fadeOut(b: StackBubble): void {
    const i = this.hanging.indexOf(b);
    if (i < 0) return; // already fading/removed
    this.hanging.splice(i, 1);
    b.cancel?.();
    b.cancel = null;
    b.el.classList.remove('latest'); // a departing bubble drops its emphasis too
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
