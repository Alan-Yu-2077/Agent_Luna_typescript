import type { StackScheduler } from './speechStackView';

// v0.36.3 (Initiative 26): your words have lift. With the chat log hidden (collapsed bar / pet mode)
// a sent message would just vanish; instead it lifts off the input bar as a buoyant bubble, sways as
// it climbs, and exits through the ceiling — 直到飘出天花板. The visual complement of her falling words.
// A thin feature layer over the shared physics scene (risers collide with nothing, pointer-events:none).

// Trim, collapse internal whitespace, and ellipsize past maxChars. Empty → '' (caller spawns nothing).
export function clipRiseText(text: string, maxChars = 64): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t) return '';
  return t.length > maxChars ? `${t.slice(0, maxChars - 1).trimEnd()}…` : t;
}

// The physics-scene surface the riser needs (satisfied by PhysicsScene).
export interface RiseScene {
  spawnRising(
    el: HTMLElement,
    opts: { anchorX: number; anchorBottomY: number; angle?: number },
  ): { onExit(cb: () => void): void; remove(): void };
}

export interface RiseBubbles {
  spawn(text: string): void;
}

export interface RiseBubbleOptions {
  doc: Document;
  scene: RiseScene;
  barRect: () => { left: number; right: number; top: number } | null; // the input bar, viewport coords
  schedule?: StackScheduler;
  rng?: () => number;
  maxChars?: number;
  maxVisible?: number;
  safetyMs?: number; // force-remove if the exit event never fires (e.g. a paused tab)
}

type Riser = { el: HTMLElement; handle: { remove(): void }; cancel: (() => void) | null };

const realScheduler: StackScheduler = (fn, ms) => {
  const h = setTimeout(fn, ms);
  return () => clearTimeout(h);
};

export function createRiseBubbles(opts: RiseBubbleOptions): RiseBubbles {
  const { doc, scene, barRect } = opts;
  const schedule = opts.schedule ?? realScheduler;
  const rng = opts.rng ?? Math.random;
  // v0.36.9: show the message IN FULL — the bubble wraps (max-width + pre-wrap) and grows taller, so
  // even a long send rises complete. The high cap only guards against a pathological outlier.
  const maxChars = opts.maxChars ?? 4000;
  const maxVisible = opts.maxVisible ?? 5;
  const safetyMs = opts.safetyMs ?? 8000;
  const live: Riser[] = [];

  const removeRiser = (r: Riser): void => {
    const i = live.indexOf(r);
    if (i < 0) return;
    live.splice(i, 1);
    r.cancel?.();
    r.cancel = null;
    r.handle.remove();
  };

  return {
    spawn(text: string): void {
      const t = clipRiseText(text, maxChars);
      if (!t) return;
      const bar = barRect();
      if (!bar) return;
      const el = doc.createElement('div');
      el.className = 'rise-bubble';
      el.textContent = t;
      // Scatter the lift-off point across the bar width so rapid sends never stack into a column.
      const cx = (bar.left + bar.right) / 2;
      const spread = (bar.right - bar.left) * 0.5;
      const anchorX = cx + (rng() - 0.5) * spread;
      const handle = scene.spawnRising(el, {
        anchorX,
        anchorBottomY: bar.top - 6,
        angle: (rng() - 0.5) * 0.3,
      });
      const riser: Riser = { el, handle, cancel: null };
      live.push(riser);
      handle.onExit(() => removeRiser(riser));
      riser.cancel = schedule(() => removeRiser(riser), safetyMs);
      while (live.length > maxVisible) removeRiser(live[0]!);
    },
  };
}
