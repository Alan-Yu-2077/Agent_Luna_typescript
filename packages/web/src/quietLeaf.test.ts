import { describe, expect, test } from 'bun:test';
import { ServerEvent } from '@luna/protocol';
import { createController, type ControllerDeps } from './controller';
import type { BubbleView, ChipKind } from './bubbles';
import type { Live2DSink, AudioSink } from './sinks';

// v0.45.11 — the leaf's contract: a quiet waking (quiet_note attached) grows exactly one leaf;
// a spoken waking grows none (the old sprout path); a pure rest stays a soft chip; a view
// without a leaf renderer falls back to a chip. Plus the protocol's additive pin: old payloads
// without the field still parse.

function makeDeps(withLeaf: boolean): {
  deps: ControllerDeps;
  leaves: string[];
  chips: Array<{ kind: ChipKind; text: string }>;
} {
  const leaves: string[] = [];
  const chips: Array<{ kind: ChipKind; text: string }> = [];
  const view: BubbleView = {
    open: () => {},
    append: () => {},
    finalize: () => {},
    discard: () => {},
    chip: (kind, text) => chips.push({ kind, text }),
    setThinking: () => {},
    ...(withLeaf ? { leaf: (note: string) => leaves.push(note) } : {}),
  };
  const live2d: Live2DSink = {
    setExpression: () => {},
    setState: () => {},
    setMouth: () => {},
    clear: () => {},
  };
  const audio: AudioSink = { speak: async () => {}, stop: () => {} };
  const deps: ControllerDeps = { view, live2d, audio };
  return { deps, leaves, chips };
}

const finished = (over: Record<string, unknown>): ServerEvent =>
  ServerEvent.parse({ type: 'proactive.finished', cycle_id: 'c1', spoke: false, ...over });

describe('protocol: quiet_note is additive', () => {
  test('old payloads (no field) and new payloads both parse', () => {
    expect(() => finished({})).not.toThrow();
    const e = finished({ quiet_note: 'searched the web · saved a memory' });
    expect(e.type === 'proactive.finished' && e.quiet_note).toBe('searched the web · saved a memory');
  });
});

describe('the leaf', () => {
  test('quiet waking → exactly one leaf with the note; no chips', () => {
    const { deps, leaves, chips } = makeDeps(true);
    const c = createController(deps);
    c.handle(finished({ quiet_note: 'read a page · saved a memory' }));
    expect(leaves).toEqual(['read a page · saved a memory']);
    expect(chips.filter((x) => x.kind === 'proactive').length).toBe(0);
  });

  test('spoken waking → no leaf (the old sprout path owns it)', () => {
    const { deps, leaves } = makeDeps(true);
    const c = createController(deps);
    c.handle(finished({ spoke: true }));
    expect(leaves).toEqual([]);
  });

  test('pure rest (no note) → the soft chip, no leaf', () => {
    const { deps, leaves, chips } = makeDeps(true);
    const c = createController(deps);
    c.handle(finished({}));
    expect(leaves).toEqual([]);
    expect(chips[0]?.text).toContain('a quiet moment');
  });

  test('a view without a leaf renderer falls back to a chip carrying the note', () => {
    const { deps, chips } = makeDeps(false);
    const c = createController(deps);
    c.handle(finished({ quiet_note: 'saved a memory' }));
    expect(chips[0]?.text).toBe('🍃 saved a memory');
  });
});
