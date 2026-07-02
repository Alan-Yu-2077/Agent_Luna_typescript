import type { BubbleView, ChipKind, HistoryTurnView } from '../bubbles';

// v0.25.0 (Initiative 18): the seam that lets collapsed mode mirror Luna's replies to the
// beside-model speech stack WITHOUT touching the controller or the wire. The controller drives ONE
// BubbleView; this router forwards every call to the window view ALWAYS (so the scrollback stays
// complete and expanding shows full history) and ADDITIONALLY to the stack when `collapsed()` is
// true. `collapsed` is read live per-call (not captured) so flipping mid-turn never strands an
// in-flight bubble. History replay goes only to the window (the stack no-ops it by design).
export class RouterBubbleView implements BubbleView {
  constructor(
    private readonly windowView: BubbleView,
    private readonly stack: BubbleView,
    private readonly collapsed: () => boolean,
  ) {}

  open(id: string): void {
    this.windowView.open(id);
    if (this.collapsed()) this.stack.open(id);
  }
  append(id: string, text: string): void {
    this.windowView.append(id, text);
    if (this.collapsed()) this.stack.append(id, text);
  }
  finalize(id: string, text: string): void {
    this.windowView.finalize(id, text);
    if (this.collapsed()) this.stack.finalize(id, text);
  }
  discard(id: string): void {
    this.windowView.discard(id);
    if (this.collapsed()) this.stack.discard(id);
  }
  chip(kind: ChipKind, text: string, href?: string): void {
    this.windowView.chip(kind, text, href);
    if (this.collapsed()) this.stack.chip(kind, text, href);
  }
  setThinking(on: boolean): void {
    this.windowView.setThinking(on);
    if (this.collapsed()) this.stack.setThinking(on);
  }
  renderHistory(turns: ReadonlyArray<HistoryTurnView>): void {
    this.windowView.renderHistory?.(turns);
  }
}
