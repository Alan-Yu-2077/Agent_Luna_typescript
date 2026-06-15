import type { Live2DSink, Live2DState } from '../sinks';
import { createLive2DRuntime, webglAvailable, type Live2DRuntime } from './cubismRuntime';
import { ModelDriver, type Live2DModelLike } from './modelDriver';
import { FaceVm } from './faceVm';

// The real Live2DSink: loads yumi via pixi-live2d-display, drives her through a
// FaceVm on the pixi ticker, and makes her draggable with a persisted offset.
// Returns null when WebGL is unavailable or loading fails, so the caller keeps
// the static placeholder and the rest of the app works.

const POS_KEY = 'luna:live2d:pos';
const ZOOM_KEY = 'luna:live2d:zoom';
const GAZE_KEY = 'luna:gaze-follow';
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 2.5;
type Offset = { dx: number; dy: number };

function clampZoom(v: number): number {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v));
}
function loadZoom(): number {
  try {
    const v = parseFloat(localStorage.getItem(ZOOM_KEY) ?? '');
    if (!Number.isNaN(v)) return clampZoom(v);
  } catch {
    /* ignore */
  }
  return 1;
}
function saveZoom(z: number): void {
  try {
    localStorage.setItem(ZOOM_KEY, String(z));
  } catch {
    /* storage unavailable — fine */
  }
}
function gazeFollowEnabled(): boolean {
  return localStorage.getItem(GAZE_KEY) !== '0';
}

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
  let zoom = loadZoom();
  const fit = (): void => {
    const hostH = host.clientHeight || 600;
    const hostW = host.clientWidth || 400;
    model.scale.set(1); // measure natural size first
    const baseScale = (hostH * 0.92) / model.height;
    model.scale.set(baseScale * zoom);
    driver.setBase((hostW - model.width) / 2, (hostH - model.height) / 2);
    driver.setPositionOffset(off.dx, off.dy);
  };
  fit();
  globalThis.addEventListener('resize', fit);

  // Take over gaze entirely. pixi's built-in autoFocus lives on model.automator
  // (NOT model.autoFocus — setting that did nothing, which is why the toggle
  // never stopped it), references the BODY CENTER, and sways the body. Kill it;
  // we drive a head-centric eyes+head gaze through FaceVm instead.
  try {
    (model as unknown as { automator: { autoFocus: boolean } }).automator.autoFocus = false;
  } catch {
    /* older build — ignore */
  }

  const faceVm = new FaceVm(driver);
  // Drive FaceVm from the model's OWN update cycle, on 'beforeModelUpdate' — the
  // point inside InternalModel.update() right after the built-in controllers
  // (auto idle-motion, eyeBlink, focus/gaze, breath, physics, pose) have run and
  // right before the model deforms. Registering on app.ticker (the old code) ran
  // FaceVm at render-LOW priority, i.e. BEFORE internalModel.update — so the auto
  // idle-motion + blink overwrote every expression/mouth write each frame (the
  // "表情完全没触发" bug). Hooking here makes FaceVm authoritative for the params
  // it displaces, while gaze-follow (focus) + physics still drive everything FaceVm
  // leaves at default (it only writes params that differ from rest by >1e-3).
  const internal = model.internalModel as unknown as {
    on(event: 'beforeModelUpdate', cb: () => void): void;
  };
  internal.on('beforeModelUpdate', () => faceVm.tick(performance.now()));

  // ?dev: expose the model + faceVm so live params can be measured from the console.
  if (typeof location !== 'undefined' && location.search.includes('dev')) {
    (globalThis as unknown as Record<string, unknown>)['__lunaDbg'] = {
      model,
      faceVm,
      param: (id: string) =>
        (
          model.internalModel.coreModel as unknown as { getParameterValueById(id: string): number }
        ).getParameterValueById(id),
    };
  }

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
  // Gaze: drive the model's focusController DIRECTLY. It runs before physics, so it
  // actually moves head + body + eyes (writing those angle params from FaceVm at
  // 'beforeModelUpdate' is too late — physics already consumed them). We do NOT use
  // model.focus(): it's direction-only (always full deflection, and focusing the
  // center degenerates to atan2(0,0)=0 → full-right, which is why "turn off" got
  // stuck looking right). Instead we feed a PROPORTIONAL, head-centric offset: the
  // pointer's distance from the FACE (~18% down the bbox) maps to focus [-1,1], so
  // the face/neck reads neutral (not "up"), and turning gaze off eases to (0,0).
  const focusController = (
    model.internalModel as unknown as {
      focusController: { focus(x: number, y: number, instant?: boolean): void };
    }
  ).focusController;
  let gazeOn = gazeFollowEnabled();
  const HEAD_FRAC = 0.18;
  const clamp1 = (v: number): number => Math.max(-1, Math.min(1, v));
  if (!gazeOn) focusController.focus(0, 0, true);
  window.addEventListener('pointermove', (e) => {
    if (!gazeOn || drag) return;
    const rect = canvas.getBoundingClientRect();
    const headX = rect.left + model.x + model.width / 2;
    const headY = rect.top + model.y + model.height * HEAD_FRAC;
    focusController.focus(
      clamp1((e.clientX - headX) / (model.width * 0.7)),
      clamp1((headY - e.clientY) / (model.height * 0.55)), // up = positive
    );
  });

  // Wheel = zoom (persisted multiplier on the fit scale, clamped).
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      zoom = clampZoom(zoom * (e.deltaY > 0 ? 0.92 : 1.08));
      saveZoom(zoom);
      fit();
    },
    { passive: false },
  );
  // Double-click recenters AND resets zoom.
  canvas.addEventListener('dblclick', () => {
    off.dx = 0;
    off.dy = 0;
    zoom = 1;
    saveOffset(off);
    saveZoom(zoom);
    fit();
  });

  return {
    setExpression: (key, emotion) => faceVm.setExpression(key, emotion),
    setState: (state: Live2DState) => faceVm.setState(state),
    setMouth: (frame) => faceVm.setMouth(frame),
    clear: () => faceVm.clear(),
    setGazeFollow: (on) => {
      try {
        localStorage.setItem(GAZE_KEY, on ? '1' : '0');
      } catch {
        /* ignore */
      }
      gazeOn = on;
      if (!on) focusController.focus(0, 0, false); // ease head/body/eyes back to center
    },
    triggerEmotion: (id, intensity) => faceVm.triggerEmotion(id, intensity),
    listEmotions: () => faceVm.listEmotions(),
  };
}
