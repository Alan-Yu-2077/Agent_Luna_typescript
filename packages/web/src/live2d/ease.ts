// Shared easing/interp vocabulary (extracted from faceVm.ts in v0.25.2 so the model glide uses the
// EXACT curves the rest of Luna's motion uses — easeInOutSine also matches CSS `ease-in-out`, so a
// JS glide reads consistent with the CSS collapse morph).
export function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
