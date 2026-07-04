import type { BubbleView, ChipKind, HistoryTurnView } from '../bubbles';

// v0.25.0 (Initiative 18): the seam that mirrors Luna's replies to the beside-model speech stack
// WITHOUT touching the controller or the wire. The controller drives ONE BubbleView; this router
// forwards every call to the window view (so the scrollback stays complete + streaming/chips live
// there) and ALSO to the stack.
//
// Design review (2026-07-04): the stack now shows in EVERY mode — windowed / app / pet — not just
// collapsed. So she visibly speaks a bubble beside her head everywhere, while the window keeps the
// full log. History replay goes only to the window (the stack no-ops it by design).
export class RouterBubbleView implements BubbleView {
  constructor(
    private readonly windowView: BubbleView,
    private readonly stack: BubbleView,
  ) {}

  open(id: string): void {
    this.windowView.open(id);
    this.stack.open(id);
  }
  append(id: string, text: string): void {
    this.windowView.append(id, text);
    this.stack.append(id, text);
  }
  finalize(id: string, text: string): void {
    this.windowView.finalize(id, text);
    this.stack.finalize(id, text);
  }
  discard(id: string): void {
    this.windowView.discard(id);
    this.stack.discard(id);
  }
  chip(kind: ChipKind, text: string, href?: string): void {
    this.windowView.chip(kind, text, href);
    this.stack.chip(kind, text, href);
  }
  setThinking(on: boolean): void {
    this.windowView.setThinking(on);
    this.stack.setThinking(on);
  }
  renderHistory(turns: ReadonlyArray<HistoryTurnView>): void {
    this.windowView.renderHistory?.(turns);
  }
}
