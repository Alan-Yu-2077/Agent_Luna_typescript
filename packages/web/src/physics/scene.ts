import { createPhysicsWorld, type BodyHandle } from './world';
import { makeDraggable } from './dragBody';
import type { Rect } from '../ui/petHitTest';

// v0.36.2: the app-facing physics scene — one fixed, full-window layer + one world, shared by the
// falling speech bubbles (here) and the rising send bubbles (v0.36.3). The layer is
// pointer-events:none so empty space stays click-through (pet mode still drags the window there);
// individual bodies opt back into pointer events so they're grabbable.

export interface FallenBubble {
  onRest(cb: () => void): void;
  onGrab(cb: () => void): void;
  remove(): void;
}

export interface PhysicsScene {
  // Re-home a hanging DOM bubble into the world at its current viewport position (zero jump) and let
  // it fall. Returns null if the element isn't measurable (e.g. detached from layout).
  detachFalling(el: HTMLElement, angle?: number): FallenBubble | null;
  interactiveRects(): Rect[];
  dispose(): void;
}

// Pure: a bubble's viewport rect + the layer's viewport origin → world spawn coords that keep the
// visual position pixel-identical. Split out so the zero-teleport handoff is unit-testable.
export function detachCoords(
  bubble: { left: number; top: number; width: number; height: number },
  layer: { left: number; top: number },
): { x: number; y: number; w: number; h: number } {
  return {
    x: bubble.left - layer.left,
    y: bubble.top - layer.top,
    w: bubble.width,
    h: bubble.height,
  };
}

export function mountPhysicsScene(): PhysicsScene {
  const layer = document.createElement('div');
  layer.className = 'physics-layer';
  document.body.appendChild(layer);

  const winSize = (): { width: number; height: number } => ({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const world = createPhysicsWorld({
    bounds: winSize(),
    onVisibility: (cb) => {
      document.addEventListener('visibilitychange', cb);
      return () => document.removeEventListener('visibilitychange', cb);
    },
  });
  const onResize = (): void => world.setBoundsFrom(winSize());
  window.addEventListener('resize', onResize);

  const tracked = new Set<HTMLElement>();

  function detachFalling(el: HTMLElement, angle = 0): FallenBubble | null {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const layerRect = layer.getBoundingClientRect();
    const { x, y, w, h } = detachCoords(rect, layerRect);
    // Freeze size + font (cqmin/em would otherwise resolve against a new container and jump), then
    // reparent to the fixed layer at top:0/left:0 so the physics transform alone places it — the
    // first synced transform lands it exactly where it hung.
    el.style.fontSize = getComputedStyle(el).fontSize;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    el.style.position = 'absolute';
    el.style.top = '0';
    el.style.left = '0';
    el.style.margin = '0';
    el.style.maxWidth = 'none';
    el.style.pointerEvents = 'auto';
    el.style.cursor = 'grab';
    el.style.touchAction = 'none';
    el.style.willChange = 'transform';
    // Kill the .speech-bubble transform transition BEFORE the first physics write, or every per-frame
    // transform would animate over 0.5s and smear the fall. Only opacity keeps its transition.
    el.style.transition = 'opacity 0.5s ease';
    layer.appendChild(el);

    const handle = world.spawn(el, { x, y, w, h, kind: 'falling', angle });
    tracked.add(el);

    const grabCbs: Array<() => void> = [];
    const wrapped: BodyHandle = {
      setPointer: (px, py) => handle.setPointer(px, py),
      grab: () => {
        for (const f of grabCbs) f();
        handle.grab();
      },
      release: (vx, vy) => handle.release(vx, vy),
      onRest: (cb) => handle.onRest(cb),
      onExit: (cb) => handle.onExit(cb),
      remove: () => handle.remove(),
    };
    const detachDrag = makeDraggable(el, wrapped, {
      toLocal: (cx, cy) => {
        const lr = layer.getBoundingClientRect();
        return { x: cx - lr.left, y: cy - lr.top };
      },
    });

    let removed = false;
    return {
      onRest: (cb) => handle.onRest(cb),
      onGrab: (cb) => grabCbs.push(cb),
      remove: () => {
        if (removed) return;
        removed = true;
        detachDrag();
        handle.remove();
        tracked.delete(el);
        el.remove();
      },
    };
  }

  function interactiveRects(): Rect[] {
    const out: Rect[] = [];
    for (const el of tracked) {
      const r = el.getBoundingClientRect();
      out.push({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
    }
    return out;
  }

  function dispose(): void {
    window.removeEventListener('resize', onResize);
    world.dispose();
    for (const el of tracked) el.remove();
    tracked.clear();
    layer.remove();
  }

  return { detachFalling, interactiveRects, dispose };
}
