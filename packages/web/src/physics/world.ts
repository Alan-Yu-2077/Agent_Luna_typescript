import Matter from 'matter-js';

// v0.36.1 (Initiative 26): the ONE physics world. Every physical behavior (falling speech bubbles,
// rising send bubbles) rides this seam — matter-js never leaks past this file, so a future swap to a
// hand-rolled integrator is a one-file change. DOM elements are rigid bodies; a fixed-timestep
// accumulator makes motion frame-rate independent; the runner pauses when the tab is hidden.

const { Engine, Bodies, Body, Composite, Events, Sleeping } = Matter;

export interface RectSize {
  readonly width: number;
  readonly height: number;
}

// The only DOM surface we touch — a `.style.transform` sink. Real elements satisfy it; tests pass a
// FakeEl so the engine steps headlessly.
export interface Transformable {
  style: { transform: string };
}

export type BodyKind = 'falling' | 'rising';

export interface SpawnOpts {
  x: number; // top-left in host coordinates
  y: number;
  w: number;
  h: number;
  kind: BodyKind;
  restitution?: number;
  angle?: number;
}

export interface BodyHandle {
  setPointer(x: number, y: number): void;
  grab(): void;
  release(vx: number, vy: number): void; // vx/vy in px per ms (screen space)
  onRest(cb: () => void): void;
  onExit(cb: () => void): void;
  remove(): void;
}

export interface WorldOpts {
  bounds: RectSize;
  now?: () => number;
  raf?: (cb: () => void) => number;
  cancelRaf?: (id: number) => void;
  onVisibility?: (cb: () => void) => () => void; // subscribe to visibilitychange; returns unsubscribe
  isHidden?: () => boolean;
  gravityScale?: number; // engine.gravity.scale (default 0.0014 — a touch snappier than matter's default)
  fixedStepMs?: number; // sub-step size (default 1000/120)
}

export interface PhysicsWorld {
  spawn(el: Transformable, opts: SpawnOpts): BodyHandle;
  setBoundsFrom(rect: RectSize): void;
  step(frameDtMs: number): void; // exposed for tests + the internal runner
  dispose(): void;
}

interface Entry {
  body: Matter.Body;
  el: Transformable;
  w: number;
  h: number;
  kind: BodyKind;
  ageMs: number;
  grabbed: boolean;
  pointer: { x: number; y: number } | null; // where a grabbed body is held (world coords)
  restFired: boolean;
  onRest?: () => void;
  onExit?: () => void;
  removed: boolean;
}

const WALL = 200; // static wall thickness — thick enough that fast bodies can't tunnel through
const MAX_FRAME_MS = 64; // clamp a long stall (tab restore) so we don't spiral the accumulator
const BUOYANCY = 1.9; // rising bodies: applied up-force as a multiple of their weight (net = up)
const SWAY_AMP = 0.00006; // lateral sway force amplitude for risers (× mass)
const SWAY_HZ = 0.6;
// A grabbed pointer velocity is px/ms; matter velocity is px per baseline 16.666ms tick. Convert on
// release so a throw carries a believable speed.
const THROW_SCALE = 16.666;

export function createPhysicsWorld(opts: WorldOpts): PhysicsWorld {
  const now = opts.now ?? (() => performance.now());
  const raf = opts.raf ?? ((cb) => requestAnimationFrame(() => cb()));
  const cancelRaf = opts.cancelRaf ?? ((id) => cancelAnimationFrame(id));
  const isHidden = opts.isHidden ?? (() => typeof document !== 'undefined' && document.hidden);
  const FIXED = opts.fixedStepMs ?? 1000 / 120;

  const engine = Engine.create();
  engine.enableSleeping = true;
  engine.gravity.y = 1;
  engine.gravity.scale = opts.gravityScale ?? 0.0014;

  const entries = new Map<number, Entry>();
  let bounds: RectSize = opts.bounds;
  let walls: Matter.Body[] = [];
  let acc = 0;
  let last = now();
  let rafId: number | null = null;
  let disposed = false;

  function buildWalls(): void {
    if (walls.length) Composite.remove(engine.world, walls);
    const { width, height } = bounds;
    // Floor at the bottom edge + side walls. NO ceiling — risers must exit the top.
    walls = [
      Bodies.rectangle(width / 2, height + WALL / 2, width + WALL * 2, WALL, { isStatic: true }),
      Bodies.rectangle(-WALL / 2, height / 2, WALL, height * 3, { isStatic: true }),
      Bodies.rectangle(width + WALL / 2, height / 2, WALL, height * 3, { isStatic: true }),
    ];
    Composite.add(engine.world, walls);
  }
  buildWalls();

  function syncEl(e: Entry): void {
    const { position, angle } = e.body;
    const tx = position.x - e.w / 2;
    const ty = position.y - e.h / 2;
    e.el.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) rotate(${angle.toFixed(4)}rad)`;
  }

  function removeEntry(e: Entry): void {
    if (e.removed) return;
    e.removed = true;
    Composite.remove(engine.world, e.body);
    entries.delete(e.body.id);
  }

  function fixedTick(): void {
    for (const e of entries.values()) {
      if (e.grabbed) continue;
      e.ageMs += FIXED;
      if (e.kind === 'rising') {
        // Buoyancy (net upward) + a gentle lateral sway — so risers drift, not shoot straight up.
        const up = -e.body.mass * engine.gravity.y * engine.gravity.scale * BUOYANCY;
        const sway = Math.sin((e.ageMs / 1000) * SWAY_HZ * Math.PI * 2) * SWAY_AMP * e.body.mass;
        Body.applyForce(e.body, e.body.position, { x: sway, y: up });
      }
    }
    Engine.update(engine, FIXED);
    // v0.36.8: a grabbed body is never frozen (no setStatic) — it stays a live dynamic body and is
    // re-pinned to the pointer AFTER the step (overriding the gravity the step just applied) and kept
    // awake, so it keeps colliding with + shoving the pile instead of tunnelling through it.
    for (const e of entries.values()) {
      if (e.grabbed && e.pointer) {
        Body.setPosition(e.body, e.pointer);
        Body.setVelocity(e.body, { x: 0, y: 0 });
        Sleeping.set(e.body, false);
      }
    }
  }

  function cullAndSync(): void {
    for (const e of [...entries.values()]) {
      if (e.removed) continue;
      const y = e.body.position.y;
      const x = e.body.position.x;
      const outTop = y < -(e.h + WALL);
      const outFar = y > bounds.height + e.h + WALL * 2 || x < -(e.w + WALL * 2) || x > bounds.width + e.w + WALL * 2;
      if (outTop || outFar) {
        e.onExit?.();
        removeEntry(e);
        continue;
      }
      syncEl(e);
    }
  }

  function step(frameDtMs: number): void {
    acc += Math.min(frameDtMs, MAX_FRAME_MS);
    while (acc >= FIXED) {
      fixedTick();
      acc -= FIXED;
    }
    cullAndSync();
  }

  function frame(): void {
    if (disposed) return;
    if (isHidden()) {
      // Paused: keep a heartbeat so we resume cleanly, but don't advance physics or re-seed a huge dt.
      last = now();
      acc = 0;
      rafId = raf(frame);
      return;
    }
    const t = now();
    step(t - last);
    last = t;
    rafId = raf(frame);
  }

  const unsubVisibility = opts.onVisibility?.(() => {
    // On becoming visible again, drop the accumulated wall-clock gap.
    last = now();
    acc = 0;
  });

  last = now();
  rafId = raf(frame);

  function spawn(el: Transformable, o: SpawnOpts): BodyHandle {
    const cx = o.x + o.w / 2;
    const cy = o.y + o.h / 2;
    const bodyOpts: Matter.IChamferableBodyDefinition = {
      restitution: o.restitution ?? 0.45,
      frictionAir: o.kind === 'rising' ? 0.02 : 0.01,
      angle: o.angle ?? 0,
      sleepThreshold: 40,
    };
    // Risers collide with NOTHING (mask 0) — they're departing words, not room objects: no bouncing
    // off walls or the other bubbles, they just drift up and out. Fallers keep default collision
    // (walls + each other → they pile).
    if (o.kind === 'rising') bodyOpts.collisionFilter = { group: 0, category: 0x0002, mask: 0x0000 };
    const body = Bodies.rectangle(cx, cy, o.w, o.h, bodyOpts);
    Composite.add(engine.world, body);
    const entry: Entry = {
      body,
      el,
      w: o.w,
      h: o.h,
      kind: o.kind,
      ageMs: 0,
      grabbed: false,
      pointer: null,
      restFired: false,
      removed: false,
    };
    entries.set(body.id, entry);
    // Rest = matter sleep. Risers never sleep (constant force keeps them awake until they exit). A
    // held body never counts as "at rest" — so its dissolve timer can't arm while you're holding it.
    Events.on(body, 'sleepStart', () => {
      if (entry.removed || entry.restFired || entry.grabbed || entry.kind !== 'falling') return;
      entry.restFired = true;
      entry.onRest?.();
    });
    syncEl(entry);

    return {
      setPointer(x, y) {
        if (entry.removed) return;
        entry.pointer = { x, y };
        Body.setPosition(body, { x, y });
      },
      grab() {
        if (entry.removed) return;
        entry.grabbed = true;
        entry.restFired = false; // picking it up re-arms rest → onRest fires again when it re-settles
        entry.pointer = { x: body.position.x, y: body.position.y }; // hold in place until dragged
        Sleeping.set(body, false); // stay a live, colliding body while held — never frozen
      },
      release(vx, vy) {
        if (entry.removed) return;
        entry.grabbed = false;
        entry.pointer = null;
        Body.setVelocity(body, { x: vx * THROW_SCALE, y: vy * THROW_SCALE });
      },
      onRest(cb) {
        entry.onRest = cb;
      },
      onExit(cb) {
        entry.onExit = cb;
      },
      remove() {
        removeEntry(entry);
      },
    };
  }

  function setBoundsFrom(rect: RectSize): void {
    bounds = { width: rect.width, height: rect.height };
    buildWalls();
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    if (rafId !== null) cancelRaf(rafId);
    rafId = null;
    unsubVisibility?.();
    for (const e of [...entries.values()]) removeEntry(e);
    Composite.clear(engine.world, false);
    Engine.clear(engine);
  }

  return { spawn, setBoundsFrom, step, dispose };
}
