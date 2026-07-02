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

describe('RouterBubbleView (v0.25.0)', () => {
  test('expanded → only the window view sees Luna replies', () => {
    const w = recorder();
    const s = recorder();
    const r = new RouterBubbleView(w.view, s.view, () => false);
    r.open('m1');
    r.append('m1', 'hi');
    r.finalize('m1', 'hello');
    expect(w.calls).toEqual([
      ['open', 'm1'],
      ['append', 'm1', 'hi'],
      ['finalize', 'm1', 'hello'],
    ]);
    expect(s.calls).toEqual([]);
  });

  test('collapsed → both the window AND the stack see them', () => {
    const w = recorder();
    const s = recorder();
    const r = new RouterBubbleView(w.view, s.view, () => true);
    r.finalize('m1', 'hello');
    expect(w.calls).toEqual([['finalize', 'm1', 'hello']]);
    expect(s.calls).toEqual([['finalize', 'm1', 'hello']]);
  });

  test('collapsed is read LIVE per call — flipping mid-stream never strands the stack', () => {
    const w = recorder();
    const s = recorder();
    let mode = false;
    const r = new RouterBubbleView(w.view, s.view, () => mode);
    r.open('m1'); // expanded — window only
    mode = true;
    r.finalize('m1', 'x'); // now collapsed — both
    expect(s.calls).toEqual([['finalize', 'm1', 'x']]); // stack never saw the earlier open
  });

  test('renderHistory goes only to the window (the stack never replays history)', () => {
    const w = recorder();
    const s = recorder();
    const r = new RouterBubbleView(w.view, s.view, () => true);
    r.renderHistory([{ userText: 'u', assistantText: 'a', tMs: 1 }]);
    expect(w.calls).toEqual([['history', 1]]);
    expect(s.calls).toEqual([]);
  });
});
