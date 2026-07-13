import { describe, expect, test } from 'bun:test';
import { sampleVelocity, type PointerSample } from './dragBody';

describe('sampleVelocity', () => {
  test('a steady trail yields the average velocity (px/ms)', () => {
    const trail: PointerSample[] = [
      { x: 0, y: 0, t: 0 },
      { x: 10, y: -5, t: 10 },
      { x: 20, y: -10, t: 20 },
      { x: 30, y: -15, t: 30 },
    ];
    const { vx, vy } = sampleVelocity(trail);
    expect(vx).toBeCloseTo(1, 3); // +1 px/ms
    expect(vy).toBeCloseTo(-0.5, 3); // −0.5 px/ms
  });

  test('only the recent window counts — an early pause does not dampen a fast flick', () => {
    const trail: PointerSample[] = [
      { x: 0, y: 0, t: 0 },
      { x: 0, y: 0, t: 500 }, // long hold
      { x: 20, y: 0, t: 520 },
      { x: 40, y: 0, t: 540 }, // fast flick at the end
    ];
    const { vx } = sampleVelocity(trail, 80);
    expect(vx).toBeCloseTo(1, 2); // 40px / 40ms, not diluted by the 500ms hold
  });

  test('a single-point trail is zero velocity (no NaN)', () => {
    const { vx, vy } = sampleVelocity([{ x: 5, y: 5, t: 5 }]);
    expect(vx).toBe(0);
    expect(vy).toBe(0);
  });

  test('an empty trail is zero velocity', () => {
    const { vx, vy } = sampleVelocity([]);
    expect(vx).toBe(0);
    expect(vy).toBe(0);
  });

  test('a zero-dt trail (same timestamps) does not divide by zero', () => {
    const { vx, vy } = sampleVelocity([
      { x: 0, y: 0, t: 100 },
      { x: 10, y: 10, t: 100 },
    ]);
    expect(Number.isFinite(vx)).toBe(true);
    expect(Number.isFinite(vy)).toBe(true);
    expect(vx).toBe(0);
    expect(vy).toBe(0);
  });
});
