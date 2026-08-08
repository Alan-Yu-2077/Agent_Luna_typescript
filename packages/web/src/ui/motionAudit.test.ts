import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { MENU_OUT_MS, PAGE_IN_DELAY_MS, PAGE_IN_MS } from './mainMenu';
import { HALF_TURN_MS, TURN_MS } from './diaryBook';
import { SLEEP_TOTAL_MS, WAKE_TOTAL_MS } from '../wakeSequence';

// v0.44.7 — D10 as an audit, not a memory. The owner approved TWO bands: stage moments (transitions,
// the wake, page turns) at 1.5–2s built from orchestrated phases, and micro feedback at ~0.3s.
// This test reads the initiative's actual CSS and constants and lists anything outside the bands —
// the defence against durations quietly scattering as future versions add motion.

// Micro band: hovers, reveals, phase segments of an orchestrated stage moment (0.5/0.6/0.9 are the
// halves that COMPOSE the 1.6s totals). Stage band: the composed totals. Ambient loops (zzz drift,
// skeleton shimmer) breathe on their own clock and are exempt by name, not silently.
const MICRO_S = [0.2, 0.3, 0.35, 0.5, 0.55, 0.6, 0.9]; // 0.55 = the tonearm drop (v0.45.4)
const STAGE_S = [1.0, 1.2, 1.6, 1.8];
const AMBIENT_S = [3.2, 1.1, 3.6]; // zzz-drift, book-shimmer, player-disc spin (v0.45.4)

describe('the two-band motion discipline (v0.44.7)', () => {
  test('every duration in the initiative CSS belongs to a declared band', () => {
    const css = readFileSync(join(import.meta.dir, 'theme.css'), 'utf8');
    const marker = css.indexOf('v0.44.0: the main menu');
    expect(marker).toBeGreaterThan(0);
    const section = css.slice(marker);
    const durations = [...section.matchAll(/(\d*\.?\d+)s\b/g)]
      .map((m) => Number.parseFloat(m[1] ?? '0'))
      .filter((v) => v > 0);
    const allowed = new Set([...MICRO_S, ...STAGE_S, ...AMBIENT_S]);
    const strays = durations.filter((d) => !allowed.has(d));
    expect(strays).toEqual([]);
  });

  test('the JS orchestration constants compose into the stage band', () => {
    // Transition I: 0.7s beat + 0.9s rise = 1.6s. The wake: 1.8s. The turns: 1.6s / 1.0s half.
    expect(PAGE_IN_DELAY_MS + PAGE_IN_MS).toBe(1600);
    expect([TURN_MS, WAKE_TOTAL_MS, HALF_TURN_MS, SLEEP_TOTAL_MS].every((ms) => ms >= 1000 && ms <= 2000)).toBe(true);
    // And the phases themselves are micro-band members, not new magic numbers.
    expect(MICRO_S).toContain(MENU_OUT_MS / 1000);
    expect(MICRO_S).toContain(PAGE_IN_MS / 1000);
  });

  test('reduced motion is a real path: the media block covers the stage movers', () => {
    const css = readFileSync(join(import.meta.dir, 'theme.css'), 'utf8');
    const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(block.length).toBeGreaterThan(100);
    for (const sel of ['.main-menu', '.menu-page', '.book-page.right.turning', '.menu-zzz span']) {
      expect(block).toContain(sel);
    }
    // The fallback duration is the short fade, not zero — state changes stay perceivable.
    expect(block).toContain('0.2s');
  });
});
