import { describe, expect, test } from 'bun:test';
import { detachCoords } from './scene';

describe('detachCoords — the zero-teleport handoff', () => {
  test('with the layer at the viewport origin, world coords equal the bubble rect', () => {
    const c = detachCoords({ left: 120, top: 80, width: 200, height: 60 }, { left: 0, top: 0 });
    expect(c).toEqual({ x: 120, y: 80, w: 200, h: 60 });
  });

  test('a shifted layer origin is subtracted so the visual position stays identical', () => {
    const c = detachCoords({ left: 300, top: 220, width: 150, height: 48 }, { left: 40, top: 16 });
    expect(c).toEqual({ x: 260, y: 204, w: 150, h: 48 });
  });

  test('size is carried through unchanged (no reflow on detach)', () => {
    const c = detachCoords({ left: 0, top: 0, width: 333, height: 77 }, { left: 10, top: 10 });
    expect(c.w).toBe(333);
    expect(c.h).toBe(77);
  });
});
