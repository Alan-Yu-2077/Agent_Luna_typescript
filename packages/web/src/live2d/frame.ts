// v0.44.8 — the lobby framing fix, reported by the owner from the packaged menu: the canvas used to
// be the session layout's right-hand slot, so a zoomed model was CLIPPED at the slot's left edge —
// a hard seam through her sleeve, naked in the middle of the open menu room. (In the session that
// same edge sits flush against the chat panel and reads as intentional cropping.)
//
// The fix: in menu mode the canvas spans the whole stage — she may extend naturally and only the
// WINDOW edge crops her, like any full-bleed art — while a frame rect keeps her BASE POSITION
// exactly where the session slot would put her. D4 survives to the pixel: when Talk swaps the menu
// for chat, the canvas re-clips to the slot at the same moment the panel fades in over that edge,
// and she never moves. The frame is a RECT (left + width), not just a left inset: the session slot
// also stops short of the window's right padding, and centring in [left, canvasRight] instead of
// the true slot would shift her half the padding at Talk.

export type Frame = { left: number; width: number };

// Where the model's left edge sits when centred inside the frame. A null/absent frame is the plain
// canvas: left 0, width = the canvas itself — which makes this the old centring expression, bit
// for bit.
export function framedBaseX(frame: Frame, modelWidth: number): number {
  const left = Math.max(0, frame.left);
  const width = Math.max(0, frame.width);
  return left + (width - modelWidth) / 2;
}

// The width the drag clamp should reason about — offsets are relative to the frame, not the window,
// or a remembered drag could strand her outside the slot she returns to at Talk.
export function frameClampWidth(frame: Frame): number {
  return Math.max(0, frame.width);
}
