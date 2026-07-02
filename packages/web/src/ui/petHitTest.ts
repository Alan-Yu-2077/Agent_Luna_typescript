// v0.26.2 (Initiative 19): pet-mode click-through hit-testing — pure + unit-testable. macOS
// click-through is whole-window only (setIgnoreMouseEvents), so the renderer decides per cursor
// position: over an interactive region (her body, the input bar, the buttons) the window takes the
// mouse; everywhere else clicks fall through to the desktop.

export type Rect = { left: number; top: number; right: number; bottom: number };

export function pointInRect(x: number, y: number, r: Rect, pad = 0): boolean {
  return x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
}

// Any-rect hit with a small padding so the edge of her sleeve is still grabbable.
export function isInteractivePoint(
  x: number,
  y: number,
  rects: ReadonlyArray<Rect | null>,
  pad = 12,
): boolean {
  return rects.some((r) => r !== null && pointInRect(x, y, r, pad));
}

// The model's viewport-space bbox from the sink-published host-relative CSS vars (--luna-model-*).
// Returns null until the sink has published (no Live2D → never interactive over the empty stage).
export function modelRectFromVars(
  hostRect: Rect,
  vars: { left: string; top: string; width: string; height: string },
): Rect | null {
  const left = parseFloat(vars.left);
  const top = parseFloat(vars.top);
  const width = parseFloat(vars.width);
  const height = parseFloat(vars.height);
  if (!Number.isFinite(left) || !Number.isFinite(width) || width <= 0) return null;
  return {
    left: hostRect.left + left,
    top: hostRect.top + top,
    right: hostRect.left + left + width,
    bottom: hostRect.top + top + (Number.isFinite(height) ? height : 0),
  };
}
