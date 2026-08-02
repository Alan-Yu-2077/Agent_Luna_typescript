import { describe, expect, test } from 'bun:test';
import { framedBaseX, frameClampWidth } from './frame';

// v0.44.8 — the lobby framing math. Two invariants matter: with the plain frame this is EXACTLY the
// old centring expression (every non-lobby surface unchanged), and with the session-slot frame the
// model's screen X is identical to what the slot-sized canvas produced — D4 to the pixel.

describe('framedBaseX', () => {
  test('the plain frame is the old centring expression, bit for bit', () => {
    for (const [hostW, w] of [
      [400, 300],
      [1280, 900],
      [1280, 1600], // zoomed wider than the host — negative base, same as before
      [777, 0],
    ] as const) {
      expect(framedBaseX({ left: 0, width: hostW }, w)).toBe((hostW - w) / 2);
    }
  });

  test('with the slot frame, her screen X equals the slot-sized canvas (D4)', () => {
    // Session geometry: slot = [left, left+width], right padding excluded — the wide canvas + frame
    // must put the model at the slot origin plus what the slot-sized host computes on its own.
    for (const [left, width, w] of [
      [530, 728, 400],
      [530, 728, 900], // zoomed wider than the slot — the case the owner saw sliced
      [610, 808, 1200],
    ] as const) {
      const slotSized = framedBaseX({ left: 0, width }, w);
      expect(framedBaseX({ left, width }, w)).toBeCloseTo(left + slotSized, 10);
    }
  });

  test('the frame ends at the slot, not the canvas edge — the 22px padding is not split', () => {
    // Canvas spans [0, 1280]; slot is [530, 1258] (right padding 22). Centring in [530, 1280]
    // instead would sit her 11px right of the session position — the shift D4 forbids.
    const slot = { left: 530, width: 1258 - 530 };
    const sessionX = 530 + framedBaseX({ left: 0, width: slot.width }, 400);
    expect(framedBaseX(slot, 400)).toBe(sessionX);
    expect(framedBaseX({ left: 530, width: 1280 - 530 }, 400)).not.toBe(sessionX);
  });

  test('degenerate frames clamp instead of exploding', () => {
    expect(framedBaseX({ left: -50, width: 1000 }, 400)).toBe(framedBaseX({ left: 0, width: 1000 }, 400));
    expect(framedBaseX({ left: 100, width: -5 }, 400)).toBe(100 - 200); // zero-width frame
    expect(Number.isFinite(framedBaseX({ left: 0, width: 0 }, 0))).toBe(true);
  });
});

describe('frameClampWidth', () => {
  test('the drag clamp reasons about the frame, not the window', () => {
    expect(frameClampWidth({ left: 0, width: 1280 })).toBe(1280);
    expect(frameClampWidth({ left: 530, width: 728 })).toBe(728);
    expect(frameClampWidth({ left: 530, width: -1 })).toBe(0);
  });
});
