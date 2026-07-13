import { describe, expect, test } from 'bun:test';
import { createPhysicsWorld, type Transformable, type WorldOpts } from './world';

class FakeEl implements Transformable {
  style = { transform: '' };
}

function parseCenter(el: FakeEl, w: number, h: number): { x: number; y: number } {
  const m = el.style.transform.match(/translate3d\(([-\d.]+)px,\s*([-\d.]+)px/);
  if (!m) return { x: NaN, y: NaN };
  return { x: parseFloat(m[1]!) + w / 2, y: parseFloat(m[2]!) + h / 2 };
}

function makeWorld(over: Partial<WorldOpts> = {}) {
  const rafIds: number[] = [];
  const cancelled: number[] = [];
  let unsubbed = 0;
  let n = 0;
  const world = createPhysicsWorld({
    bounds: { width: 400, height: 600 },
    now: () => 0, // step() is driven manually in tests; the frame loop never runs
    raf: () => {
      const id = ++n;
      rafIds.push(id);
      return id;
    },
    cancelRaf: (id) => cancelled.push(id),
    onVisibility: () => () => {
      unsubbed++;
    },
    isHidden: () => false,
    ...over,
  });
  return { world, rafIds, cancelled, unsubbed: () => unsubbed };
}

const drive = (world: ReturnType<typeof createPhysicsWorld>, frames: number, dt = 16): void => {
  for (let i = 0; i < frames; i++) world.step(dt);
};

describe('physics world — falling', () => {
  test('a falling body reaches the floor and comes to rest (onRest fires, y ≈ floor − h/2)', () => {
    const { world } = makeWorld();
    const el = new FakeEl();
    const h = 64;
    let rested = false;
    const handle = world.spawn(el, { x: 168, y: 0, w: 64, h, kind: 'falling' });
    handle.onRest(() => {
      rested = true;
    });
    drive(world, 600); // ~9.6s of sim
    const { y } = parseCenter(el, 64, h);
    expect(rested).toBe(true);
    expect(y).toBeGreaterThan(600 - h / 2 - 12);
    expect(y).toBeLessThan(600 - h / 2 + 2);
  });

  test('restitution: the first bounce rises off the floor but not back to the drop height', () => {
    const { world } = makeWorld();
    const el = new FakeEl();
    const h = 64;
    const dropY = 0 + h / 2; // spawn center
    world.spawn(el, { x: 168, y: 0, w: 64, h, kind: 'falling', restitution: 0.9 });
    let firstContact = -1;
    let apexAfterContact = Infinity;
    const floorCenter = 600 - h / 2;
    for (let i = 0; i < 220; i++) {
      world.step(16);
      const { y } = parseCenter(el, 64, h);
      if (firstContact < 0 && y >= floorCenter - 3) firstContact = i;
      else if (firstContact >= 0 && i > firstContact) apexAfterContact = Math.min(apexAfterContact, y);
    }
    expect(firstContact).toBeGreaterThan(0); // it did hit the floor
    // a real bounce: rose clearly back up off the floor…
    expect(apexAfterContact).toBeLessThan(floorCenter - 12);
    // …but never back above where it was dropped from.
    expect(apexAfterContact).toBeGreaterThan(dropY);
  });
});

describe('physics world — rising', () => {
  test('a rising body exits the top (removed) and never rests', () => {
    const { world } = makeWorld();
    const el = new FakeEl();
    const h = 64;
    let rested = false;
    let exited = false;
    const handle = world.spawn(el, { x: 168, y: 600 - 150, w: 64, h, kind: 'rising' });
    handle.onRest(() => {
      rested = true;
    });
    handle.onExit(() => {
      exited = true;
    });
    drive(world, 800);
    expect(exited).toBe(true);
    expect(rested).toBe(false);
  });

  test('a riser exits within a sane time band and drifts sideways (the sway is real)', () => {
    const { world } = makeWorld();
    const el = new FakeEl();
    const startX = 200;
    let exited = false;
    let exitFrame = -1;
    let maxDrift = 0;
    const handle = world.spawn(el, { x: startX - 32, y: 600 - 120, w: 64, h: 64, kind: 'rising' });
    handle.onExit(() => {
      exited = true;
    });
    for (let i = 0; i < 400; i++) {
      world.step(16);
      if (!exited) {
        const { x } = parseCenter(el, 64, 64);
        if (!Number.isNaN(x)) maxDrift = Math.max(maxDrift, Math.abs(x - startX));
      } else if (exitFrame < 0) {
        exitFrame = i;
      }
    }
    expect(exited).toBe(true);
    expect(exitFrame).toBeGreaterThan(10); // not instant — it climbs
    expect(exitFrame).toBeLessThan(400); // ≤ ~6.4s
    expect(maxDrift).toBeGreaterThan(0.5); // it swayed, didn't rise dead straight
  });
});

describe('physics world — fixed timestep', () => {
  test('1×32ms and 2×16ms land within tolerance (accumulator carries the remainder)', () => {
    const a = makeWorld();
    const b = makeWorld();
    const ea = new FakeEl();
    const eb = new FakeEl();
    a.world.spawn(ea, { x: 168, y: 0, w: 64, h: 64, kind: 'falling' });
    b.world.spawn(eb, { x: 168, y: 0, w: 64, h: 64, kind: 'falling' });
    for (let i = 0; i < 40; i++) {
      a.world.step(32);
      b.world.step(16);
      b.world.step(16);
    }
    const ya = parseCenter(ea, 64, 64).y;
    const yb = parseCenter(eb, 64, 64).y;
    expect(Math.abs(ya - yb)).toBeLessThan(8);
  });
});

describe('physics world — drag & throw', () => {
  test('grab() freezes gravity; release(vx,vy) carries that velocity', () => {
    const { world } = makeWorld();
    const el = new FakeEl();
    const handle = world.spawn(el, { x: 100, y: 100, w: 64, h: 64, kind: 'falling' });
    drive(world, 6); // fall a little
    handle.grab();
    const held = parseCenter(el, 64, 64);
    drive(world, 40); // gravity must not move a held body
    const afterHold = parseCenter(el, 64, 64);
    expect(Math.abs(afterHold.y - held.y)).toBeLessThan(0.5);
    expect(Math.abs(afterHold.x - held.x)).toBeLessThan(0.5);

    handle.release(0.4, -0.4); // throw up-right (px/ms)
    const atRelease = parseCenter(el, 64, 64);
    drive(world, 4);
    const moved = parseCenter(el, 64, 64);
    expect(moved.x).toBeGreaterThan(atRelease.x); // carried +x
    expect(moved.y).toBeLessThan(atRelease.y); // carried −y (upward) before gravity wins
  });

  test('setPointer moves a grabbed body exactly where told', () => {
    const { world } = makeWorld();
    const el = new FakeEl();
    const handle = world.spawn(el, { x: 100, y: 100, w: 64, h: 64, kind: 'falling' });
    handle.grab();
    handle.setPointer(250, 300);
    world.step(16);
    const c = parseCenter(el, 64, 64);
    expect(c.x).toBeCloseTo(250, 0);
    expect(c.y).toBeCloseTo(300, 0);
  });
});

describe('physics world — lifecycle', () => {
  test('dispose() cancels the pending frame and unsubscribes visibility', () => {
    const { world, rafIds, cancelled, unsubbed } = makeWorld();
    expect(rafIds.length).toBe(1); // one frame scheduled at construction
    world.dispose();
    expect(cancelled).toContain(rafIds[0]!);
    expect(unsubbed()).toBe(1);
  });

  test('the frame loop advances physics while visible but freezes while hidden', () => {
    let clock = 0;
    let hidden = false;
    let frameCb: (() => void) | null = null;
    const world = createPhysicsWorld({
      bounds: { width: 400, height: 600 },
      now: () => clock,
      raf: (cb) => {
        frameCb = cb;
        return 1;
      },
      cancelRaf: () => {},
      onVisibility: () => () => {},
      isHidden: () => hidden,
    });
    const el = new FakeEl();
    world.spawn(el, { x: 168, y: 0, w: 64, h: 64, kind: 'falling' });
    const fire = (): void => {
      clock += 16;
      const cb = frameCb;
      frameCb = null;
      cb?.();
    };
    for (let i = 0; i < 20; i++) fire(); // visible → falls
    const yVisible = parseCenter(el, 64, 64).y;
    expect(yVisible).toBeGreaterThan(32); // moved down from spawn center (y=32)

    hidden = true;
    for (let i = 0; i < 40; i++) fire(); // hidden → no advance
    const yHidden = parseCenter(el, 64, 64).y;
    expect(Math.abs(yHidden - yVisible)).toBeLessThan(0.5);

    hidden = false;
    for (let i = 0; i < 40; i++) fire(); // visible again → resumes falling, no teleport from the gap
    const yResumed = parseCenter(el, 64, 64).y;
    expect(yResumed).toBeGreaterThan(yHidden);
  });
});
