import { describe, expect, test } from 'bun:test';
import { SpeechStackView, type StackScheduler } from './speechStackView';

// bun test has no DOM, so a minimal fake element — enough for the stack's create/append/remove/fade.
class FakeEl {
  className = '';
  textContent = '';
  children: FakeEl[] = [];
  parent: FakeEl | null = null;
  private classes = new Set<string>();
  classList = {
    add: (c: string): void => {
      this.classes.add(c);
    },
    contains: (c: string): boolean => this.classes.has(c),
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

function stackOf(opts: { ttlMs?: number; fadeMs?: number; maxVisible?: number } = {}): {
  view: SpeechStackView;
  container: FakeEl;
  fireAll: () => void;
} {
  const host = new FakeEl();
  const { schedule, fireAll } = manualScheduler();
  // WHY as unknown: FakeEl is a minimal DOM stand-in (bun test has no DOM); we exercise stack logic.
  const view = new SpeechStackView(host as unknown as HTMLElement, { ...opts, schedule });
  const container = host.children[0]!; // the `.speech-stack` container the view created
  return { view, container, fireAll };
}

describe('SpeechStackView (v0.25.0)', () => {
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
});
