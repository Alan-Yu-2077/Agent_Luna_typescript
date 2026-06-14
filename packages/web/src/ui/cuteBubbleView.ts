import type { BubbleView, ChipKind } from '../bubbles';
import { absoluteStamp, relativeTime } from './time';
import { toolCardLabel } from './toolLabels';

// The cute UI's BubbleView. The controller drives open/append/finalize/discard
// for Luna's message bubbles (right side) and chip() for tool/dream/proactive/
// error cards; the app shell calls userMessage() for the user's echo (left
// side). Each bubble gets a timestamp line (data-ts → refreshed by time.ts).

type Role = 'user' | 'luna';
type Bubble = { row: HTMLElement; body: HTMLElement };

export class CuteBubbleView implements BubbleView {
  private readonly bubbles = new Map<string, Bubble>();

  constructor(private readonly host: HTMLElement) {}

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

  private scroll(): void {
    this.host.scrollTop = this.host.scrollHeight;
  }

  open(id: string): void {
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
    this.scroll();
  }
}
