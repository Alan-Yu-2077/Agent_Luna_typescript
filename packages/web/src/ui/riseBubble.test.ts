import { describe, expect, test } from 'bun:test';
import { clipRiseText, createRiseBubbles, type RiseScene } from './riseBubble';
import type { StackScheduler } from './speechStackView';

describe('clipRiseText', () => {
  test('passes short text through unchanged', () => {
    expect(clipRiseText('fries win', 64)).toBe('fries win');
  });
  test('collapses internal whitespace/newlines to single spaces', () => {
    expect(clipRiseText('  hello \n\n  world  ', 64)).toBe('hello world');
  });
  test('ellipsizes past the cap', () => {
    const out = clipRiseText('x'.repeat(100), 10);
    expect(out.length).toBe(10);
    expect(out.endsWith('…')).toBe(true);
  });
  test('empty / whitespace-only → empty string', () => {
    expect(clipRiseText('   \n  ', 64)).toBe('');
    expect(clipRiseText('', 64)).toBe('');
  });
});

// Minimal DOM + scene stubs (bun test has no DOM).
class FakeEl {
  className = '';
  textContent = '';
  style: Record<string, string> = {};
  removed = false;
  remove(): void {
    this.removed = true;
  }
}
type SpawnRec = { el: FakeEl; opts: { anchorX: number; anchorBottomY: number; angle?: number }; exit: () => void; removed: () => boolean };

function harness(barRect: () => { left: number; right: number; top: number } | null) {
  const spawns: SpawnRec[] = [];
  const scene: RiseScene = {
    spawnRising: (el, opts) => {
      let exitCb = (): void => {};
      let removed = false;
      spawns.push({
        el: el as unknown as FakeEl,
        opts,
        exit: () => exitCb(),
        removed: () => removed,
      });
      return {
        onExit: (cb) => {
          exitCb = cb;
        },
        remove: () => {
          removed = true;
        },
      };
    },
  };
  const tasks: Array<{ fn: () => void; live: boolean }> = [];
  const schedule: StackScheduler = (fn) => {
    const t = { fn, live: true };
    tasks.push(t);
    return () => {
      t.live = false;
    };
  };
  const fireAll = (): void => {
    for (const t of [...tasks]) if (t.live) { t.live = false; t.fn(); }
  };
  const doc = { createElement: (_tag: string): FakeEl => new FakeEl() } as unknown as Document;
  const rise = createRiseBubbles({ doc, scene, barRect, schedule, rng: () => 0.5 });
  return { rise, spawns, fireAll };
}

const bar = () => ({ left: 100, right: 300, top: 500 });

describe('createRiseBubbles', () => {
  test('a send in a collapsed bar lifts a bubble off bar-center, styled like the user bubble', () => {
    const { rise, spawns } = harness(bar);
    rise.spawn('take care');
    expect(spawns.length).toBe(1);
    expect(spawns[0]!.el.className).toBe('rise-bubble');
    expect(spawns[0]!.el.textContent).toBe('take care');
    expect(spawns[0]!.opts.anchorX).toBe(200); // rng 0.5 → no lateral offset → dead center
    expect(spawns[0]!.opts.anchorBottomY).toBe(494); // just above the bar top (500 − 6)
  });

  test('empty text spawns nothing', () => {
    const { rise, spawns } = harness(bar);
    rise.spawn('   ');
    expect(spawns.length).toBe(0);
  });

  test('no measurable bar → no spawn', () => {
    const { rise, spawns } = harness(() => null);
    rise.spawn('hi');
    expect(spawns.length).toBe(0);
  });

  test('exiting the ceiling removes the riser', () => {
    const { rise, spawns } = harness(bar);
    rise.spawn('bye');
    expect(spawns[0]!.removed()).toBe(false);
    spawns[0]!.exit();
    expect(spawns[0]!.removed()).toBe(true);
  });

  test('rapid sends cap at maxVisible (5) — the oldest is culled', () => {
    const { rise, spawns } = harness(bar);
    for (let i = 0; i < 10; i++) rise.spawn(`m${i}`);
    expect(spawns.length).toBe(10); // all attempted
    const liveCount = spawns.filter((s) => !s.removed()).length;
    expect(liveCount).toBe(5); // only 5 alive
    expect(spawns[0]!.removed()).toBe(true); // oldest culled
    expect(spawns[9]!.removed()).toBe(false); // newest alive
  });

  test('the safety timer removes a riser whose exit never fired', () => {
    const { rise, spawns, fireAll } = harness(bar);
    rise.spawn('stuck');
    expect(spawns[0]!.removed()).toBe(false);
    fireAll(); // safety scheduler fires
    expect(spawns[0]!.removed()).toBe(true);
  });
});
