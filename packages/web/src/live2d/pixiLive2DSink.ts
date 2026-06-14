import type { Live2DSink, Live2DState } from '../sinks';
import { createLive2DRuntime, webglAvailable, type Live2DRuntime } from './cubismRuntime';
import { ModelDriver, type Live2DModelLike } from './modelDriver';
import { FaceVm } from './faceVm';

// The real Live2DSink: loads yumi via pixi-live2d-display, drives her through a
// FaceVm on the pixi ticker, and makes her draggable with a persisted offset.
// Returns null when WebGL is unavailable or loading fails, so the caller keeps
// the static placeholder and the rest of the app works.

const POS_KEY = 'luna:live2d:pos';
type Offset = { dx: number; dy: number };

function loadOffset(): Offset {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (raw) {
      const v = JSON.parse(raw) as { dx?: unknown; dy?: unknown };
      if (typeof v.dx === 'number' && typeof v.dy === 'number') return { dx: v.dx, dy: v.dy };
    }
  } catch {
    /* ignore malformed */
  }
  return { dx: 0, dy: 0 };
}
function saveOffset(o: Offset): void {
  try {
    localStorage.setItem(POS_KEY, JSON.stringify(o));
  } catch {
    /* storage unavailable — fine */
  }
}

function clampOffset(v: number, max: number): number {
  return Math.max(-max, Math.min(max, v));
}

export async function createPixiLive2DSink(
  host: HTMLElement,
  modelUrl = '/models/yumi/yumi.model3.json',
): Promise<Live2DSink | null> {
  if (!webglAvailable()) return null;

  let runtime: Live2DRuntime;
  try {
    runtime = await createLive2DRuntime(host);
  } catch {
    return null;
  }
  const { app, Live2DModel } = runtime;

  let model: Awaited<ReturnType<typeof Live2DModel.from>>;
  try {
    model = await Live2DModel.from(modelUrl);
  } catch {
    app.destroy(true, { children: true });
    return null;
  }

  // WHY as unknown as: pixi-live2d-display bundles its own PIXI types, so its
  // Live2DModel is not structurally our pixi.js DisplayObject / Live2DModelLike.
  app.stage.addChild(model as unknown as Parameters<typeof app.stage.addChild>[0]);
  const driver = new ModelDriver(model as unknown as Live2DModelLike);

  const off = loadOffset();
  const fit = (): void => {
    const hostH = host.clientHeight || 600;
    const hostW = host.clientWidth || 400;
    model.scale.set(1);
    model.scale.set((hostH * 0.92) / model.height);
    driver.setBase((hostW - model.width) / 2, (hostH - model.height) / 2);
    driver.setPositionOffset(off.dx, off.dy);
  };
  fit();
  globalThis.addEventListener('resize', fit);

  const faceVm = new FaceVm(driver);
  app.ticker.add(() => faceVm.tick(performance.now()));

  // WHY as unknown as: app.view is pixi's ICanvas union; we drive it as a DOM canvas.
  const canvas = app.view as unknown as HTMLCanvasElement;
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;touch-action:none;cursor:grab;';
  let drag: { id: number; x: number; y: number } | null = null;
  canvas.addEventListener('pointerdown', (e) => {
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* pointer already released / synthetic — drag still works without capture */
    }
    canvas.style.cursor = 'grabbing';
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    off.dx = clampOffset(off.dx + (e.clientX - drag.x), host.clientWidth * 0.5);
    off.dy = clampOffset(off.dy + (e.clientY - drag.y), host.clientHeight * 0.5);
    drag.x = e.clientX;
    drag.y = e.clientY;
    driver.setPositionOffset(off.dx, off.dy);
  });
  const endDrag = (e: PointerEvent): void => {
    if (drag && e.pointerId === drag.id) {
      drag = null;
      canvas.style.cursor = 'grab';
      saveOffset(off);
    }
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('dblclick', () => {
    off.dx = 0;
    off.dy = 0;
    driver.setPositionOffset(0, 0);
    saveOffset(off);
  });

  return {
    setExpression: (key, emotion) => faceVm.setExpression(key, emotion),
    setState: (state: Live2DState) => faceVm.setState(state),
    setMouthOpen: (value) => faceVm.setMouth(value),
    clear: () => faceVm.clear(),
  };
}
