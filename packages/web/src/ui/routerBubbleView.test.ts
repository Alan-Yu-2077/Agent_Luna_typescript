import { describe, expect, test } from 'bun:test';
import type { BubbleView, ChipKind } from '../bubbles';
import { RouterBubbleView } from './routerBubbleView';

type Call = [string, ...unknown[]];
function recorder(): { view: BubbleView; calls: Call[] } {
  const calls: Call[] = [];
  const view: BubbleView = {
    open: (id) => calls.push(['open', id]),
    append: (id, t) => calls.push(['append', id, t]),
    finalize: (id, t) => calls.push(['finalize', id, t]),
    discard: (id) => calls.push(['discard', id]),
    chip: (k: ChipKind, t, h?: string) => calls.push(['chip', k, t, h]),
    setThinking: (on) => calls.push(['thinking', on]),
    renderHistory: (turns) => calls.push(['history', turns.length]),
  };
  return { view, calls };
}

describe('RouterBubbleView (v0.25.0 + 2026-07-04 all-modes)', () => {
  test('every reply goes to BOTH the window and the stack (all modes)', () => {
    const w = recorder();
    const s = recorder();
    const r = new RouterBubbleView(w.view, s.view);
    r.open('m1');
    r.append('m1', 'hi');
    r.finalize('m1', 'hello');
    const expected: Call[] = [
      ['open', 'm1'],
      ['append', 'm1', 'hi'],
      ['finalize', 'm1', 'hello'],
    ];
    expect(w.calls).toEqual(expected);
    expect(s.calls).toEqual(expected);
  });

  test('discard / chip / setThinking also fan out to both', () => {
    const w = recorder();
    const s = recorder();
    const r = new RouterBubbleView(w.view, s.view);
    r.chip('tool', 'ran a tool', undefined);
    r.setThinking(true);
    r.discard('m1');
    expect(w.calls).toEqual(s.calls);
    expect(s.calls).toEqual([
      ['chip', 'tool', 'ran a tool', undefined],
      ['thinking', true],
      ['discard', 'm1'],
    ]);
  });

  test('renderHistory goes only to the window (the stack never replays history)', () => {
    const w = recorder();
    const s = recorder();
    const r = new RouterBubbleView(w.view, s.view);
    r.renderHistory([{ userText: 'u', assistantText: 'a', tMs: 1 }]);
    expect(w.calls).toEqual([['history', 1]]);
    expect(s.calls).toEqual([]);
  });
});
