import type { BubbleView, ChipKind } from '../bubbles';
import { absoluteStamp, relativeTime } from './time';
import { toolCardLabel } from './toolLabels';

// The cute UI's BubbleView. Luna's message bubbles (right) + tool/dream/proactive
// cards come from the controller; the app calls userMessage() for the user echo
// (left). v0.13.4 adds a thinking indicator and a scroll-to-latest pill (auto-
// scroll only when already at the bottom).

type Role = 'user' | 'luna';
type Bubble = { row: HTMLElement; body: HTMLElement };

export class CuteBubbleView implements BubbleView {
  private readonly bubbles = new Map<string, Bubble>();
  private thinkingEl: HTMLElement | null = null;

  constructor(
    private readonly host: HTMLElement,
    private readonly scrollPill?: HTMLButtonElement,
  ) {
    this.scrollPill?.addEventListener('click', () => this.scrollToBottom());
  }

  private make(role: Role): Bubble {
    const doc = this.host.ownerDocument;
    const row = doc.createElement('div');
    row.className = `bubble-row ${role}`;
    const body = doc.createElement('div');
    body.className = `bubble ${role}`;
    row.appendChild(body);
    return { row, body };
  }

  private stamp(row: HTMLElement, ms: number): void {
    const ts = this.host.ownerDocument.createElement('div');
    ts.className = 'ts';
    ts.dataset['ts'] = `${ms}`;
    ts.title = absoluteStamp(ms);
    ts.textContent = relativeTime(ms, ms);
    row.appendChild(ts);
  }

  private atBottom(): boolean {
    return this.host.scrollHeight - this.host.scrollTop - this.host.clientHeight < 48;
  }
  private scroll(): void {
    if (this.atBottom()) this.scrollToBottom();
    else this.scrollPill?.classList.add('on');
  }
  scrollToBottom(): void {
    this.host.scrollTop = this.host.scrollHeight;
    this.scrollPill?.classList.remove('on');
  }

  showThinking(): void {
    if (this.thinkingEl) return;
    const doc = this.host.ownerDocument;
    const el = doc.createElement('div');
    el.className = 'thinking';
    for (let i = 0; i < 3; i++) el.appendChild(doc.createElement('i'));
    this.host.appendChild(el);
    this.thinkingEl = el;
    this.scrollToBottom();
  }
  hideThinking(): void {
    this.thinkingEl?.remove();
    this.thinkingEl = null;
  }

  open(id: string): void {
    this.hideThinking();
    if (this.bubbles.has(id)) return;
    const b = this.make('luna');
    this.bubbles.set(id, b);
    this.host.appendChild(b.row);
    this.scroll();
  }

  append(id: string, text: string): void {
    let b = this.bubbles.get(id);
    if (!b) {
      this.open(id);
      b = this.bubbles.get(id)!;
    }
    b.body.textContent += text;
    this.scroll();
  }

  finalize(id: string, text: string): void {
    let b = this.bubbles.get(id);
    if (!b) {
      this.open(id);
      b = this.bubbles.get(id)!;
    }
    b.body.textContent = text;
    this.stamp(b.row, Date.now());
    this.bubbles.delete(id);
    this.scroll();
  }

  discard(id: string): void {
    const b = this.bubbles.get(id);
    if (b) b.row.remove();
    this.bubbles.delete(id);
  }

  chip(kind: ChipKind, text: string): void {
    this.hideThinking();
    const card = this.host.ownerDocument.createElement('div');
    card.className = `card ${kind}`;
    card.textContent = kind === 'tool' ? toolCardLabel(text) : text;
    this.host.appendChild(card);
    this.scroll();
  }

  userMessage(text: string): void {
    const b = this.make('user');
    b.body.textContent = text;
    this.host.appendChild(b.row);
    this.stamp(b.row, Date.now());
    this.scrollToBottom();
  }
}
