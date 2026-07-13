import { describe, expect, test } from 'bun:test';
import { SpeechStackView, type StackScheduler, type DetachFn } from './speechStackView';

// bun test has no DOM, so a minimal fake element — enough for the stack's create/append/remove/fade.
class FakeEl {
  className = '';
  textContent = '';
  style: Record<string, string> = {};
  children: FakeEl[] = [];
  parent: FakeEl | null = null;
  // className is the single source of truth (the real code mixes `className =` and classList.*)
  classList = {
    add: (c: string): void => {
      const s = new Set(this.className.split(' ').filter(Boolean));
      s.add(c);
      this.className = [...s].join(' ');
    },
    remove: (c: string): void => {
      this.className = this.className
        .split(' ')
        .filter((x) => x && x !== c)
        .join(' ');
    },
    contains: (c: string): boolean => this.className.split(' ').includes(c),
  };
  ownerDocument = { createElement: (_tag: string): FakeEl => new FakeEl() };
  appendChild(c: FakeEl): FakeEl {
    c.parent = this;
    this.children.push(c);
    return c;
  }
  remove(): void {
    if (this.parent) {
      this.parent.children = this.parent.children.filter((x) => x !== this);
      this.parent = null;
    }
  }
}

// A manual scheduler: records tasks, fires all still-live ones on demand (a snapshot per call, so a
// task scheduled DURING firing runs on the next fireAll — models the ttl→fade cascade).
function manualScheduler(): { schedule: StackScheduler; fireAll: () => void } {
  const tasks: { fn: () => void; live: boolean }[] = [];
  const schedule: StackScheduler = (fn) => {
    const t = { fn, live: true };
    tasks.push(t);
    return () => {
      t.live = false;
    };
  };
  const fireAll = (): void => {
    for (const t of [...tasks]) {
      if (t.live) {
        t.live = false;
        t.fn();
      }
    }
  };
  return { schedule, fireAll };
}

// rng() → 0.9 forces every bubble to the LEFT zone (right = rng() < 0.5 → false), so the behavioural
// tests get a single deterministic zone to assert order against.
function stackOf(opts: { ttlMs?: number; fadeMs?: number; maxVisible?: number } = {}): {
  view: SpeechStackView;
  outer: FakeEl;
  leftZone: FakeEl;
  container: FakeEl; // the left zone — where the forced-left bubbles land
  fireAll: () => void;
} {
  const host = new FakeEl();
  const { schedule, fireAll } = manualScheduler();
  // WHY as unknown: FakeEl is a minimal DOM stand-in (bun test has no DOM); we exercise stack logic.
  const view = new SpeechStackView(host as unknown as HTMLElement, { ...opts, schedule, rng: () => 0.9 });
  const outer = host.children[0]!; // the `.speech-stack` container (holds the two zones)
  const leftZone = outer.children[0]!;
  return { view, outer, leftZone, container: leftZone, fireAll };
}

describe('SpeechStackView (v0.25.0 + 2026-07-04 random-side)', () => {
  test('creates two head-anchored zones (left + right)', () => {
    const { outer } = stackOf();
    expect(outer.className).toContain('speech-stack');
    expect(outer.children.map((c) => c.className)).toEqual(['speech-zone left', 'speech-zone right']);
  });

  test('finalize adds a bubble; newest is the last child (bottom of the column)', () => {
    const { view, container } = stackOf();
    view.finalize('m1', 'first');
    view.finalize('m2', 'second');
    expect(container.children.map((c) => c.textContent)).toEqual(['first', 'second']);
  });

  test('an empty/whitespace reply adds no bubble', () => {
    const { view, container } = stackOf();
    view.finalize('m1', '   ');
    expect(container.children.length).toBe(0);
  });

  test('a bubble fades then is removed after its TTL', () => {
    const { view, container, fireAll } = stackOf({ ttlMs: 100, fadeMs: 50 });
    view.finalize('m1', 'hi');
    expect(container.children.length).toBe(1);
    fireAll(); // TTL fires → fading class
    expect(container.children[0]!.classList.contains('fading')).toBe(true);
    fireAll(); // fade fires → removed
    expect(container.children.length).toBe(0);
  });

  test('overflow cap fast-fades the oldest bubble', () => {
    const { view, container } = stackOf({ maxVisible: 2 });
    view.finalize('a', 'a');
    view.finalize('b', 'b');
    view.finalize('c', 'c');
    const oldest = container.children.find((c) => c.textContent === 'a');
    expect(oldest?.classList.contains('fading')).toBe(true); // over the cap → fading
    expect(container.children.some((c) => c.textContent === 'b')).toBe(true);
    expect(container.children.some((c) => c.textContent === 'c')).toBe(true);
  });

  test('clearAll (barge-in) fades every live bubble', () => {
    const { view, container } = stackOf();
    view.finalize('a', 'a');
    view.finalize('b', 'b');
    view.clearAll();
    expect(container.children.every((c) => c.classList.contains('fading'))).toBe(true);
  });

  test('noteSpeechStart keeps the newest bubble alive (restarts its life), then it still expires', () => {
    const { view, container, fireAll } = stackOf({ ttlMs: 100, fadeMs: 50 });
    view.finalize('m1', 'hi');
    view.noteSpeechStart();
    expect(container.children.length).toBe(1);
    fireAll(); // TTL
    fireAll(); // fade
    expect(container.children.length).toBe(0);
  });

  test('open / append / renderHistory are no-ops (the stack shows only finalized replies)', () => {
    const { view, container } = stackOf();
    view.open('m1');
    view.append('m1', 'streaming…');
    view.renderHistory([{ userText: 'u', assistantText: 'a', tMs: 1 }]);
    expect(container.children.length).toBe(0);
  });

  test('the newest bubble carries .latest (the tail); the previous loses it the moment it becomes history', () => {
    const { view, container } = stackOf();
    view.finalize('m1', 'first');
    expect(container.children[0]!.classList.contains('latest')).toBe(true);
    view.finalize('m2', 'second');
    expect(container.children[0]!.classList.contains('latest')).toBe(false); // tail dropped
    expect(container.children[1]!.classList.contains('latest')).toBe(true); // newest has it
  });

  test('a fading bubble drops its tail too', () => {
    const { view, container } = stackOf();
    view.finalize('m1', 'only');
    view.clearAll();
    expect(container.children[0]!.classList.contains('latest')).toBe(false);
    expect(container.children[0]!.classList.contains('fading')).toBe(true);
  });

  // ── random side + jitter (2026-07-04 design review) ──
  test('each bubble picks a random side; a right-side pick lands in the right zone with side-right', () => {
    const host = new FakeEl();
    const { schedule } = manualScheduler();
    // rng() → 0.1 (< 0.5) forces the RIGHT side.
    const view = new SpeechStackView(host as unknown as HTMLElement, { schedule, rng: () => 0.1 });
    view.finalize('m1', 'over here');
    const outer = host.children[0]!;
    const rightZone = outer.children[1]!;
    expect(rightZone.children.length).toBe(1);
    expect(rightZone.children[0]!.className).toContain('side-right');
    expect(outer.children[0]!.children.length).toBe(0); // nothing in the left zone
  });

  test('the vertical jitter comes from the injected rng (side pick, then marginTop)', () => {
    const host = new FakeEl();
    const { schedule } = manualScheduler();
    let calls = 0;
    const rng = (): number => {
      calls += 1;
      return 0.5; // side: 0.5 < 0.5 is false → LEFT
    };
    const view = new SpeechStackView(host as unknown as HTMLElement, { schedule, rng });
    view.finalize('m1', 'hi');
    const el = host.children[0]!.children[0]!.children[0]!; // outer → left zone → bubble
    expect(el.className).toContain('side-left');
    expect(el.style['marginTop']).toBe('6px'); // 2 + 0.5 × 8
    expect(calls).toBe(2); // one rng for the side, one for the jitter
  });
});

// ── v0.36.2: detach → fall → dissolve lifecycle (injected physics seam) ──
type DetachRec = { el: FakeEl; angle: number; removed: boolean; fireRest: () => void; fireGrab: () => void };
function physicsStackOf(opts: {
  ttlMs?: number;
  fadeMs?: number;
  maxVisible?: number;
  maxFallen?: number;
  dissolveMs?: number;
} = {}): { view: SpeechStackView; container: FakeEl; fireAll: () => void; detached: DetachRec[] } {
  const host = new FakeEl();
  const { schedule, fireAll } = manualScheduler();
  const detached: DetachRec[] = [];
  const detach: DetachFn = (el, angle) => {
    let restCb = (): void => {};
    let grabCb = (): void => {};
    const rec: DetachRec = {
      el: el as unknown as FakeEl,
      angle,
      removed: false,
      fireRest: () => restCb(),
      fireGrab: () => grabCb(),
    };
    detached.push(rec);
    return {
      onRest: (cb) => {
        restCb = cb;
      },
      onGrab: (cb) => {
        grabCb = cb;
      },
      remove: () => {
        rec.removed = true;
        rec.el.remove();
      },
    };
  };
  // rng 0.9 → all bubbles to the LEFT zone (deterministic single column).
  const view = new SpeechStackView(host as unknown as HTMLElement, { ...opts, schedule, rng: () => 0.9, detach });
  const container = host.children[0]!.children[0]!; // outer → left zone
  return { view, container, fireAll, detached };
}

describe('SpeechStackView (v0.36.2 fall lifecycle)', () => {
  test('noteSpeechEnd detaches the OLDEST hanging bubble (FIFO — playback is serialized)', () => {
    const { view, detached } = physicsStackOf();
    view.finalize('a', 'first');
    view.finalize('b', 'second');
    expect(detached.length).toBe(0); // both still hanging
    view.noteSpeechEnd();
    expect(detached.length).toBe(1);
    expect(detached[0]!.el.textContent).toBe('first');
    expect(detached[0]!.el.classList.contains('fallen')).toBe(true);
  });

  test('voiceless: the hang TTL expires into a fall (detach), not a fade', () => {
    const { view, detached, fireAll } = physicsStackOf({ ttlMs: 100 });
    view.finalize('a', 'hi');
    fireAll(); // ttl fires → detachOrFade → detach
    expect(detached.length).toBe(1);
    expect(detached[0]!.el.classList.contains('fading')).toBe(false); // it fell, it did not fade
  });

  test('a fallen bubble dissolves after dissolveMs at rest, then removes', () => {
    const { view, detached, fireAll } = physicsStackOf({ dissolveMs: 30_000, fadeMs: 50 });
    view.finalize('a', 'hi');
    view.noteSpeechEnd();
    const rec = detached[0]!;
    rec.fireRest(); // onRest → arm the 30s dissolve
    fireAll(); // dissolve fires → fading + schedule removal
    expect(rec.el.classList.contains('fading')).toBe(true);
    fireAll(); // removal fires → physics handle removed
    expect(rec.removed).toBe(true);
  });

  test('picking up a resting bubble cancels its pending dissolve (drag re-arms on release)', () => {
    const { view, detached, fireAll } = physicsStackOf({ dissolveMs: 30_000, fadeMs: 50 });
    view.finalize('a', 'hi');
    view.noteSpeechEnd();
    const rec = detached[0]!;
    rec.fireRest(); // arm dissolve
    rec.fireGrab(); // picked up → cancel the pending dissolve
    fireAll();
    expect(rec.el.classList.contains('fading')).toBe(false);
    expect(rec.removed).toBe(false);
  });

  test('the resting pile caps at maxFallen — the oldest fast-dissolves', () => {
    const { view, detached } = physicsStackOf({ maxFallen: 2 });
    for (const t of ['a', 'b', 'c']) view.finalize(t, t);
    view.noteSpeechEnd(); // a falls
    view.noteSpeechEnd(); // b falls
    view.noteSpeechEnd(); // c falls → 3 > 2 → oldest (a) dissolves
    const a = detached.find((d) => d.el.textContent === 'a')!;
    expect(a.el.classList.contains('fading')).toBe(true);
    const c = detached.find((d) => d.el.textContent === 'c')!;
    expect(c.el.classList.contains('fading')).toBe(false);
  });

  test('barge-in clears HANGING bubbles but spares fallen floor objects', () => {
    const { view, container, detached } = physicsStackOf();
    view.finalize('a', 'a');
    view.noteSpeechEnd(); // a → fallen
    view.finalize('b', 'b'); // b → hanging
    view.clearAll();
    const a = detached[0]!;
    expect(a.el.classList.contains('fading')).toBe(false); // floor object survives
    const b = container.children.find((c) => c.textContent === 'b')!;
    expect(b.classList.contains('fading')).toBe(true); // spoken-over hanging bubble cleared
  });
});
