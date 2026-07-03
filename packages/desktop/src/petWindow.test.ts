import { describe, expect, test } from 'bun:test';
import { petWindowOptions } from './petWindow';

describe('petWindowOptions (v0.28.2)', () => {
  test('transparent, frameless, always-on-top — AND resizable with a min size', () => {
    const o = petWindowOptions();
    expect(o.transparent).toBe(true);
    expect(o.frame).toBe(false);
    expect(o.alwaysOnTop).toBe(true);
    expect(o.resizable).toBe(true); // the whole pet scales by resizing the window
    expect(o.maximizable).toBe(false); // a maximized transparent pet is nonsense
    expect(o.minWidth).toBeGreaterThan(0);
    expect(o.minHeight).toBeGreaterThan(0);
  });
});
