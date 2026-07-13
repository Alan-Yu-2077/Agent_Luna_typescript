import type { BodyHandle } from './world';

// v0.36.1: the pointer↔body conversation. pointerdown grabs the body (kinematic), pointermove feeds
// it positions, release hands back a velocity sampled from the recent pointer trail (the throw). The
// velocity math is pure and split out so it can be unit-tested without a DOM.

export interface PointerSample {
  x: number;
  y: number;
  t: number; // ms
}

// Velocity (px/ms) from a pointer trail (oldest→newest). Uses a short recent window so a pause
// before release reads as a slow throw, not a fling. Degenerate trails (0/1 point, zero dt) → no
// velocity, never NaN.
export function sampleVelocity(trail: readonly PointerSample[], windowMs = 80): { vx: number; vy: number } {
  if (trail.length < 2) return { vx: 0, vy: 0 };
  const last = trail[trail.length - 1]!;
  // Walk back to the OLDEST sample still inside the window; stop at the first one that falls outside
  // it. A long pause before the release therefore doesn't dilute a fast final flick.
  let ref = last;
  for (let i = trail.length - 2; i >= 0; i--) {
    if (last.t - trail[i]!.t > windowMs) break;
    ref = trail[i]!;
  }
  const dt = last.t - ref.t;
  if (dt <= 0) return { vx: 0, vy: 0 };
  return { vx: (last.x - ref.x) / dt, vy: (last.y - ref.y) / dt };
}

export interface DraggableOpts {
  // Map a client (viewport) point into the physics host's local coordinates.
  toLocal(clientX: number, clientY: number): { x: number; y: number };
  now?: () => number;
  trailCap?: number; // max samples retained (default 6)
}

// Wire a DOM element's pointer events to a BodyHandle. Returns a detach function.
export function makeDraggable(target: HTMLElement, handle: BodyHandle, opts: DraggableOpts): () => void {
  const now = opts.now ?? (() => performance.now());
  const cap = opts.trailCap ?? 6;
  let trail: PointerSample[] = [];
  let dragging = false;
  let pointerId: number | null = null;

  const push = (clientX: number, clientY: number): { x: number; y: number } => {
    const local = opts.toLocal(clientX, clientY);
    trail.push({ x: local.x, y: local.y, t: now() });
    if (trail.length > cap) trail.shift();
    return local;
  };

  const onDown = (ev: PointerEvent): void => {
    if (dragging) return;
    dragging = true;
    pointerId = ev.pointerId;
    trail = [];
    push(ev.clientX, ev.clientY);
    handle.grab();
    target.setPointerCapture?.(ev.pointerId);
    ev.preventDefault();
  };
  const onMove = (ev: PointerEvent): void => {
    if (!dragging || ev.pointerId !== pointerId) return;
    const local = push(ev.clientX, ev.clientY);
    handle.setPointer(local.x, local.y);
  };
  const onUp = (ev: PointerEvent): void => {
    if (!dragging || ev.pointerId !== pointerId) return;
    dragging = false;
    pointerId = null;
    push(ev.clientX, ev.clientY);
    const { vx, vy } = sampleVelocity(trail);
    handle.release(vx, vy);
    target.releasePointerCapture?.(ev.pointerId);
  };

  target.addEventListener('pointerdown', onDown);
  target.addEventListener('pointermove', onMove);
  target.addEventListener('pointerup', onUp);
  target.addEventListener('pointercancel', onUp);

  return () => {
    target.removeEventListener('pointerdown', onDown);
    target.removeEventListener('pointermove', onMove);
    target.removeEventListener('pointerup', onUp);
    target.removeEventListener('pointercancel', onUp);
  };
}
