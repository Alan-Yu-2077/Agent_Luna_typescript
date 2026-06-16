// The bubble state machine seam. The controller drives BubbleView; the browser
// uses DomBubbleView, tests use a mock. Bubbles are keyed by an id (a message
// tool call_id, or the synthetic 'reply' id for text-mode token streaming) so
// multiple message bubbles per turn each stream independently — the v0.6.2
// reality, not the Python single-bubble merge.

export type ChipKind = 'tool' | 'dream' | 'proactive' | 'expression' | 'error' | 'source';

// One persisted turn, replayed on (re)connect. user is empty for a proactive turn.
export type HistoryTurnView = { userText: string; assistantText: string; tMs: number };

export interface BubbleView {
  // replay the persisted conversation on connect — clears + rerenders so it is
  // idempotent across reconnects (optional; only the cute view implements it)
  renderHistory?(turns: ReadonlyArray<HistoryTurnView>): void;
  // create (or no-op if already open) a streaming assistant bubble for `id`
  open(id: string): void;
  // append a streamed fragment to the bubble (creates it if missing)
  append(id: string, text: string): void;
  // set the bubble's final text (the validated delivery)
  finalize(id: string, text: string): void;
  // remove a bubble (e.g. a streamed preview whose delivery failed validation)
  discard(id: string): void;
  // a non-bubble marker: tool/dream/proactive/expression/error
  chip(kind: ChipKind, text: string): void;
}

// A DOM implementation for the browser. Renders bubbles + chips into a host
// element. Deliberately minimal — the real Live2D-framed UI is a later pass.
export class DomBubbleView implements BubbleView {
  private readonly bubbles = new Map<string, HTMLElement>();

  constructor(private readonly host: HTMLElement) {}

  private el(cls: string, text = ''): HTMLElement {
    const d = this.host.ownerDocument.createElement('div');
    d.className = cls;
    d.textContent = text;
    this.host.appendChild(d);
    this.host.scrollTop = this.host.scrollHeight;
    return d;
  }

  open(id: string): void {
    if (this.bubbles.has(id)) return;
    this.bubbles.set(id, this.el('luna-bubble', ''));
  }

  append(id: string, text: string): void {
    let b = this.bubbles.get(id);
    if (!b) {
      this.open(id);
      b = this.bubbles.get(id)!;
    }
    b.textContent += text;
    this.host.scrollTop = this.host.scrollHeight;
  }

  finalize(id: string, text: string): void {
    const b = this.bubbles.get(id);
    if (b) b.textContent = text;
    else this.el('luna-bubble', text);
    this.bubbles.delete(id);
  }

  discard(id: string): void {
    const b = this.bubbles.get(id);
    if (b) b.remove();
    this.bubbles.delete(id);
  }

  chip(kind: ChipKind, text: string): void {
    this.el(`luna-chip ${kind}`, text);
  }
}
