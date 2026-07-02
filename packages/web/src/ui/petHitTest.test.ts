import { describe, expect, test } from 'bun:test';
import { isInteractivePoint, modelRectFromVars, pointInRect, type Rect } from './petHitTest';

const model: Rect = { left: 400, top: 100, right: 700, bottom: 800 };
const bar: Rect = { left: 300, top: 840, right: 860, bottom: 890 };

describe('pet click-through hit-test (v0.26.2)', () => {
  test('inside her body / the input bar → interactive; empty margins → pass-through', () => {
    expect(isInteractivePoint(550, 400, [model, bar])).toBe(true);
    expect(isInteractivePoint(500, 860, [model, bar])).toBe(true);
    expect(isInteractivePoint(100, 100, [model, bar])).toBe(false);
    expect(isInteractivePoint(900, 500, [model, bar])).toBe(false);
  });

  test('the padding keeps her sleeve edge grabbable; null rects are ignored', () => {
    expect(isInteractivePoint(710, 400, [model, null], 12)).toBe(true); // 10px past the bbox
    expect(isInteractivePoint(730, 400, [model, null], 12)).toBe(false);
    expect(isInteractivePoint(550, 400, [null, null])).toBe(false);
  });

  test('pointInRect edges are inclusive', () => {
    expect(pointInRect(400, 100, model)).toBe(true);
    expect(pointInRect(700, 800, model)).toBe(true);
  });

  test('modelRectFromVars offsets the host + degrades to null before the sink publishes', () => {
    const host: Rect = { left: 50, top: 20, right: 1050, bottom: 920 };
    expect(
      modelRectFromVars(host, { left: '100px', top: '30px', width: '300px', height: '700px' }),
    ).toEqual({ left: 150, top: 50, right: 450, bottom: 750 });
    expect(modelRectFromVars(host, { left: '', top: '', width: '', height: '' })).toBeNull();
  });
});
