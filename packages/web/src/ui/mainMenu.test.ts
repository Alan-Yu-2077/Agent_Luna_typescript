import { describe, expect, test } from 'bun:test';
import {
  MENU_OUT_MS,
  menuItems,
  nextFocusIndex,
  PAGE_IN_DELAY_MS,
  PAGE_IN_MS,
  springLinear,
} from './mainMenu';

// The DOM half of the menu is exercised by the packaged smoke (real Chromium — bun has no DOM);
// what lives here is the data and math the DOM is assembled from.

describe('menuItems — six doors, and Quit only where something can quit', () => {
  test('the desktop gets all six, in the approved order', () => {
    expect(menuItems({ hasQuit: true, dreamEnabled: true }).map((i) => i.id)).toEqual([
      'talk',
      'diary',
      'skills',
      'dream',
      'settings',
      'quit',
    ]);
  });

  test('a browser tab renders no Quit — its close button is not ours to duplicate', () => {
    const ids = menuItems({ hasQuit: false, dreamEnabled: true }).map((i) => i.id);
    expect(ids).not.toContain('quit');
    expect(ids.length).toBe(5);
  });

  // D1's hierarchy: the four doors to her are primary; the two meta items are secondary.
  test('Talk/Diary/Skills/Dream are primary, Settings/Quit secondary', () => {
    const items = menuItems({ hasQuit: true, dreamEnabled: true });
    const primaries = items.filter((i) => i.primary).map((i) => i.id);
    expect(primaries).toEqual(['talk', 'diary', 'skills', 'dream']);
  });

  // v0.44.0 ships Dream grey (v0.44.1 wires it) — disabled, present, honest about it.
  test('dream renders disabled until it is wired', () => {
    const dream = menuItems({ hasQuit: true, dreamEnabled: false }).find((i) => i.id === 'dream');
    expect(dream?.disabled).toBe(true);
    expect(menuItems({ hasQuit: true, dreamEnabled: true }).find((i) => i.id === 'dream')?.disabled).toBeFalsy();
  });
});

describe('nextFocusIndex — arrow keys cycle the ENABLED items', () => {
  const enabled = [true, true, true, false, true, true]; // dream (index 3) disabled

  test('cycles forward and wraps', () => {
    expect(nextFocusIndex(0, 1, enabled)).toBe(1);
    expect(nextFocusIndex(5, 1, enabled)).toBe(0);
  });

  test('skips a disabled item in both directions', () => {
    expect(nextFocusIndex(2, 1, enabled)).toBe(4); // over dream going down
    expect(nextFocusIndex(4, -1, enabled)).toBe(2); // over dream going up
  });

  test('no focus yet (-1) lands on the first enabled item', () => {
    expect(nextFocusIndex(-1, 1, enabled)).toBe(0);
  });

  test('degenerate inputs cannot loop forever', () => {
    expect(nextFocusIndex(0, 1, [])).toBe(-1);
    expect(nextFocusIndex(0, 1, [false, false])).toBe(-1);
  });
});

describe('springLinear — a real spring, sampled honestly', () => {
  test('starts at 0 and ends at exactly 1 — an easing that ends elsewhere snaps on arrival', () => {
    const curve = springLinear();
    expect(curve.startsWith('linear(0')).toBe(true);
    expect(curve.endsWith('1)')).toBe(true);
  });

  test('the approved constants (k≈190, c≈11) overshoot — that IS the hover feel', () => {
    const values = springLinear()
      .slice('linear('.length, -1)
      .split(', ')
      .map(Number);
    expect(Math.max(...values)).toBeGreaterThan(1.1); // ~25% first-peak overshoot
    expect(Math.max(...values)).toBeLessThan(1.45); // springy, not rubbery
  });

  test('an overdamped spring never crosses 1', () => {
    const values = springLinear(100, 30, 1)
      .slice('linear('.length, -1)
      .split(', ')
      .map(Number);
    expect(Math.max(...values)).toBeLessThanOrEqual(1);
  });
});

// D10: transitions are 1.5–2s and the slowness is orchestrated — menu out, a beat, page up.
test('transition I totals 1.6s in two overlapping phases, not one long tween', () => {
  expect(PAGE_IN_DELAY_MS + PAGE_IN_MS).toBe(1600);
  expect(MENU_OUT_MS).toBeLessThan(PAGE_IN_DELAY_MS); // the beat between the phases exists
});
