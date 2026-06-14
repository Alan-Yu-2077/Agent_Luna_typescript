import * as PIXI from 'pixi.js';

// pixi-live2d-display reaches for window.PIXI for its ticker/interaction plumbing.
(globalThis as unknown as { PIXI: typeof PIXI }).PIXI = PIXI;

type Cubism4 = typeof import('pixi-live2d-display/cubism4');
export type Live2DRuntime = { app: PIXI.Application; Live2DModel: Cubism4['Live2DModel'] };

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

let corePromise: Promise<void> | null = null;
// Cubism Core is a non-module global script. It MUST be present before the
// cubism4 plugin module evaluates (it checks for the runtime at import time),
// so we load the script here and only then dynamic-import the plugin.
function loadCubismCore(src = '/live2dcubismcore.min.js'): Promise<void> {
  if (corePromise) return corePromise;
  corePromise = new Promise<void>((resolve, reject) => {
    if ((globalThis as Record<string, unknown>)['Live2DCubismCore']) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`failed to load Cubism core: ${src}`));
    document.head.appendChild(s);
  });
  return corePromise;
}

export async function createLive2DRuntime(host: HTMLElement): Promise<Live2DRuntime> {
  await loadCubismCore();
  const { Live2DModel } = await import('pixi-live2d-display/cubism4');
  Live2DModel.registerTicker(PIXI.Ticker);
  const app = new PIXI.Application({
    resizeTo: host,
    backgroundAlpha: 0,
    antialias: true,
    autoDensity: true,
    resolution: globalThis.devicePixelRatio || 1,
  });
  host.appendChild(app.view as unknown as HTMLCanvasElement);
  return { app, Live2DModel };
}
