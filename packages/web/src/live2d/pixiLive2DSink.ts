import type { Live2DSink, Live2DState } from '../sinks';
import { createLive2DRuntime, webglAvailable, type Live2DRuntime } from './cubismRuntime';
import { ModelDriver, type Live2DModelLike } from './modelDriver';
import { FaceVm } from './faceVm';
import { createGlide } from './glide';
import { petFraming } from './petFraming';
import { DEFAULT_IDLE_PROFILE, IDLE_PROFILE_IDS, type IdleProfileId } from './faceData';

// The real Live2DSink: loads the configured Live2D model via pixi-live2d-display, drives it through a
// FaceVm on the pixi ticker, and makes it draggable with a persisted offset. Returns null when no model
// URL is configured, WebGL is unavailable, or loading fails, so the caller keeps the empty-state
// placeholder and the rest of the app works.

const POS_KEY = 'luna:live2d:pos';
const ZOOM_KEY = 'luna:live2d:zoom';
const GAZE_KEY = 'luna:gaze-follow';
const IDLE_KEY = 'luna:idle-profile';
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
function loadIdleProfile(): IdleProfileId {
  try {
    const v = localStorage.getItem(IDLE_KEY);
    if (v && IDLE_PROFILE_IDS.includes(v)) return v as IdleProfileId;
  } catch {
    /* storage unavailable — fall through */
  }
  return DEFAULT_IDLE_PROFILE;
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
  opts: { pet?: boolean; modelUrl?: string } = {},
): Promise<Live2DSink | null> {
  const modelUrl = opts.modelUrl;
  if (!modelUrl) return null; // no avatar installed — the caller shows the empty state
  // v0.28.1: pet mode fixes the model as a half-body portrait — no drag, no scroll-zoom (v0.28.2
  // hands move/resize to the WINDOW instead). Windowed mode keeps full-body + drag + zoom.
  const pet = opts.pet === true;
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
    if (pet) {
      // Fixed half-body portrait, derived from the LIVE host dims so it re-fits on window resize
      // (v0.28.2). No persisted drag/zoom — the model is inert in pet mode.
      const f = petFraming(hostW, hostH, model.width, model.height);
      model.scale.set(f.scale);
      driver.setBase(f.baseX, f.baseY);
      driver.setPositionOffset(0, 0);
      return;
    }
    const baseScale = (hostH * 0.92) / model.height;
    model.scale.set(baseScale * zoom);
    driver.setBase((hostW - model.width) / 2, (hostH - model.height) / 2);
    // v0.25.2 review fix: re-clamp the persisted drag against the CURRENT host dims (the pointermove
    // clamp only ran at drag time — a drag saved in full-width collapsed mode could strand her
    // entirely off-canvas after expand shrinks the host; persisted, so she stayed gone on reload).
    const healedDx = clampOffset(off.dx, hostW * 0.5);
    const healedDy = clampOffset(off.dy, hostH * 0.5);
    if (healedDx !== off.dx || healedDy !== off.dy) {
      off.dx = healedDx;
      off.dy = healedDy;
      saveOffset(off);
    }
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

  const faceVm = new FaceVm(driver, {
    idleProfile: loadIdleProfile(),
    gazeActive: gazeFollowEnabled(),
  });
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
    on(event: 'afterMotionUpdate' | 'beforeModelUpdate', cb: () => void): void;
  };
  // v0.25.2: the layout glide — a transient mode-offset easing to 0 on the model's own update beat
  // (ONE animation system; a competing CSS/rAF tween would fight fit()'s snaps). `modeX` mirrors the
  // driver's current mode offset so a mid-glide retarget stays visually continuous.
  const glide = createGlide();
  let modeX = 0;
  const setMode = (x: number): void => {
    modeX = x;
    driver.setModeOffset(x, 0);
  };

  // v0.25.2 (the owner's design review): the speech-bubble stack anchors beside the model's HEAD, so the
  // sink publishes the head position (same HEAD_FRAC anchor the gaze uses) as CSS vars on the host —
  // fit/drag/zoom/glide all keep the bubbles tracking her face. Change-guarded to avoid style thrash.
  let lastHeadKey = '';
  const updateHeadAnchor = (): void => {
    const x = Math.round(Math.max(170, model.x + model.width / 2));
    const y = Math.round(model.y + model.height * HEAD_FRAC);
    // The lateral clearance the bubbles keep from the head CENTER — past the hair, so a bubble
    // never covers her (per the owner: 气泡不能挡住模型). Scales with the model (zoom/viewport).
    const gap = Math.round(model.width * 0.26);
    // v0.26.2: the model's host-relative bbox — pet mode's click-through hit-test reads these to
    // keep the cursor interactive over her body and pass-through everywhere else.
    const left = Math.round(model.x);
    const top = Math.round(model.y);
    const key = `${x}:${y}:${gap}:${left}:${top}:${Math.round(model.width)}`;
    if (key === lastHeadKey) return;
    lastHeadKey = key;
    host.style.setProperty('--luna-head-x', `${x}px`);
    host.style.setProperty('--luna-head-y', `${y}px`);
    host.style.setProperty('--luna-head-gap', `${gap}px`);
    host.style.setProperty('--luna-model-left', `${left}px`);
    host.style.setProperty('--luna-model-top', `${top}px`);
    host.style.setProperty('--luna-model-width', `${Math.round(model.width)}px`);
    host.style.setProperty('--luna-model-height', `${Math.round(model.height)}px`);
  };

  // The head/body pose is physics-input, so it must be written BEFORE physics runs
  // ('afterMotionUpdate'); the rest (brows/eyes/mouth) is written at
  // 'beforeModelUpdate' (after the built-in eyeBlink/focus) so FaceVm wins there.
  internal.on('afterMotionUpdate', () => faceVm.flushPose());
  internal.on('beforeModelUpdate', () => {
    faceVm.tick(performance.now());
    const g = glide.step(performance.now());
    if (g !== null) setMode(g);
    updateHeadAnchor();
  });

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
  // pet: the model is inert (window-drag takes over in v0.28.2) → no grab cursor.
  const cursor = pet ? 'default' : 'grab';
  canvas.style.cssText = `position:absolute;inset:0;width:100%;height:100%;touch-action:none;cursor:${cursor};`;
  let drag: { id: number; x: number; y: number } | null = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (pet) return; // pet mode: no model drag
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

  // Wheel = zoom (persisted multiplier on the fit scale, clamped). Disabled in pet mode — the
  // portrait is fixed; v0.28.2 scales the whole pet by resizing the WINDOW.
  canvas.addEventListener(
    'wheel',
    (e) => {
      if (pet) return;
      e.preventDefault();
      zoom = clampZoom(zoom * (e.deltaY > 0 ? 0.92 : 1.08));
      saveZoom(zoom);
      fit();
    },
    { passive: false },
  );
  // Double-click recenters AND resets zoom (windowed only).
  canvas.addEventListener('dblclick', () => {
    if (pet) return;
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
    // v0.25.2: FLIP-style layout glide. Capture the model's screen-space x, run the layout change
    // (the caller toggles `.collapsed` + dispatches `resize`, which snaps fit() to the new center),
    // then set the mode offset so she APPEARS unmoved and ease it to 0 — she glides to her new home.
    // `+ modeX` keeps a mid-glide retarget continuous (the stale offset cancels out of the rect math).
    glideLayout: (mutate: () => void) => {
      const beforeX = canvas.getBoundingClientRect().left + model.x;
      mutate();
      const afterX = canvas.getBoundingClientRect().left + model.x;
      const delta = beforeX - afterX + modeX;
      glide.start(delta, performance.now());
      const g = glide.step(performance.now());
      setMode(g ?? 0);
    },
    setGazeFollow: (on) => {
      try {
        localStorage.setItem(GAZE_KEY, on ? '1' : '0');
      } catch {
        /* ignore */
      }
      gazeOn = on;
      faceVm.setGazeActive(on); // off → the idle profile wanders the gaze itself
      if (!on) focusController.focus(0, 0, false); // ease head/body/eyes back to center
    },
    triggerEmotion: (id, intensity) => faceVm.triggerEmotion(id, intensity),
    listEmotions: () => faceVm.listEmotions(),
    setIdleProfile: (id) => faceVm.setIdleProfile(id),
    listIdleProfiles: () => faceVm.listIdleProfiles(),
  };
}
