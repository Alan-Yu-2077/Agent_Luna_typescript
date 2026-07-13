import { createPhysicsWorld, type BodyKind } from './world';
import { makeDraggable } from './dragBody';

// v0.36.1 TEMPORARY scaffolding (removed in v0.36.2): a `?dev`-panel harness that spawns test bodies
// so the physics world can be eyeballed in the browser — a 💬 falls/bounces/rests, a 🫧 rises and
// exits the top; both draggable + throwable. Not wired into any real behavior.
export interface PhysicsDevHarness {
  spawn(kind: BodyKind): void;
  step(dtMs: number): void; // manual driving (dev inspection when rAF is paused / a hidden tab)
  dispose(): void;
}

export function mountPhysicsDevHarness(): PhysicsDevHarness {
  const layer = document.createElement('div');
  layer.style.cssText = 'position:fixed;inset:0;z-index:9998;pointer-events:none;overflow:hidden;';
  document.body.appendChild(layer);

  const rect = (): { width: number; height: number } => ({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const world = createPhysicsWorld({
    bounds: rect(),
    onVisibility: (cb) => {
      document.addEventListener('visibilitychange', cb);
      return () => document.removeEventListener('visibilitychange', cb);
    },
  });
  const onResize = (): void => world.setBoundsFrom(rect());
  window.addEventListener('resize', onResize);

  let n = 0;
  const spawn = (kind: BodyKind): void => {
    const size = 64;
    const el = document.createElement('div');
    el.textContent = kind === 'rising' ? '🫧' : '💬';
    el.style.cssText =
      `position:absolute;top:0;left:0;width:${size}px;height:${size}px;display:flex;` +
      'align-items:center;justify-content:center;font-size:30px;background:rgba(191,224,251,.94);' +
      'border-radius:18px;box-shadow:0 6px 18px rgba(39,73,107,.25);pointer-events:auto;cursor:grab;' +
      'will-change:transform;user-select:none;touch-action:none;';
    layer.appendChild(el);
    const startX = 80 + (n++ % 5) * 84;
    const startY = kind === 'rising' ? window.innerHeight - 150 : 50;
    const handle = world.spawn(el, {
      x: startX,
      y: startY,
      w: size,
      h: size,
      kind,
      angle: Math.sin(n) * 0.3,
    });
    handle.onExit(() => el.remove());
    makeDraggable(el, handle, { toLocal: (cx, cy) => ({ x: cx, y: cy }) });
  };

  const dispose = (): void => {
    window.removeEventListener('resize', onResize);
    world.dispose();
    layer.remove();
  };

  return { spawn, step: (dt) => world.step(dt), dispose };
}
