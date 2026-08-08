import { afterEach, describe, expect, test } from 'bun:test';
import {
  DEFAULT_DREAM_WINDOW,
  dreamStatus,
  dreamWindowOpen,
  enterDream,
  parkFinishedIdle,
  parseDreamWindow,
  resetDreamStateForTests,
  shutdownDreamDue,
  wake,
} from './dreamState';

// v0.32.5 — the shutdown dream now only fires when the last dream is at least
// LUNA_SHUTDOWN_DREAM_MIN_GAP_MS old, so a desktop's every-close SIGTERM stops
// triggering a full dream cycle each quit.

const SIX_H = 21_600_000;
const NOW = 1_000_000_000_000;

describe('shutdownDreamDue (v0.32.5)', () => {
  test('never dreamt → due (the final exit should consolidate)', () => {
    expect(shutdownDreamDue(null, NOW, SIX_H)).toBe(true);
  });

  test('last dream more recent than the gap → NOT due (the every-close spam case)', () => {
    expect(shutdownDreamDue(NOW - 60_000, NOW, SIX_H)).toBe(false); // 1 min ago
    expect(shutdownDreamDue(NOW - (SIX_H - 1), NOW, SIX_H)).toBe(false); // just under 6h
  });

  test('last dream exactly at / past the gap → due', () => {
    expect(shutdownDreamDue(NOW - SIX_H, NOW, SIX_H)).toBe(true); // boundary is inclusive
    expect(shutdownDreamDue(NOW - 2 * SIX_H, NOW, SIX_H)).toBe(true);
  });

  test('minGap 0 restores the old always-dream behaviour', () => {
    expect(shutdownDreamDue(NOW, NOW, 0)).toBe(true);
    expect(shutdownDreamDue(NOW - 1, NOW, 0)).toBe(true);
  });
});

// v0.45.7 (Initiative 33) — the gate's real-world death, pinned as a regression: last_dream_ms
// used to stamp only on COMPLETED cycles, so a run of aborted dreams (8/8: four in 40 minutes)
// left the stamp frozen days back and every shutdown perpetually "due". The stamp now lands on
// ATTEMPT (enterDream), because a try has already spent the LLM budget the gate guards.

const local = (h: number, min = 0): number => new Date(2026, 7, 8, h, min).getTime();

describe('attempt-stamp semantics (v0.45.7 — the M2 regression)', () => {
  afterEach(() => resetDreamStateForTests());

  test('entering a dream stamps last_dream_ms immediately', () => {
    resetDreamStateForTests();
    expect(dreamStatus().last_dream_ms).toBeNull();
    const before = Date.now();
    expect(enterDream().ok).toBe(true);
    const stamp = dreamStatus().last_dream_ms;
    expect(stamp).not.toBeNull();
    expect(stamp!).toBeGreaterThanOrEqual(before);
  });

  test('an ABORTED attempt still holds the gate: second exit within 6h is NOT due', () => {
    resetDreamStateForTests();
    enterDream();
    // no parkFinishedIdle — the dream died mid-flight (the 8/8 production shape)
    const stamp = dreamStatus().last_dream_ms!;
    expect(shutdownDreamDue(stamp, stamp + 60_000, SIX_H)).toBe(false);
    expect(shutdownDreamDue(stamp, stamp + SIX_H, SIX_H)).toBe(true); // recovers after the gap
  });

  test('a completed cycle re-stamps at completion (harmless later overwrite)', () => {
    resetDreamStateForTests();
    enterDream();
    const attempt = dreamStatus().last_dream_ms!;
    parkFinishedIdle();
    expect(dreamStatus().last_dream_ms!).toBeGreaterThanOrEqual(attempt);
    expect(wake().ok).toBe(true);
  });

  test('the manual dream.enter path stamps too — a 20:30 manual dream blocks a 21:30 exit re-dream', () => {
    resetDreamStateForTests();
    enterDream(); // runDreamCycle's entry — manual and shutdown share it
    const stamp = dreamStatus().last_dream_ms!;
    expect(shutdownDreamDue(stamp, stamp + 3_600_000, SIX_H)).toBe(false);
  });
});

describe('dreamWindowOpen (v0.45.7 — the owner\'s night rule, local clock)', () => {
  test('the four boundary minutes: 20:59 closed, 21:00 open, 05:59 open, 06:00 closed', () => {
    expect(dreamWindowOpen(local(20, 59))).toBe(false);
    expect(dreamWindowOpen(local(21, 0))).toBe(true);
    expect(dreamWindowOpen(local(5, 59))).toBe(true);
    expect(dreamWindowOpen(local(6, 0))).toBe(false);
  });

  test('midnight sides open; noon closed', () => {
    expect(dreamWindowOpen(local(23, 30))).toBe(true);
    expect(dreamWindowOpen(local(0, 0))).toBe(true);
    expect(dreamWindowOpen(local(12, 0))).toBe(false);
  });

  test('a non-wrapping override window works too', () => {
    const w = { startHour: 9, endHour: 17 };
    expect(dreamWindowOpen(local(9), w)).toBe(true);
    expect(dreamWindowOpen(local(16, 59), w)).toBe(true);
    expect(dreamWindowOpen(local(17), w)).toBe(false);
    expect(dreamWindowOpen(local(3), w)).toBe(false);
  });
});

describe('parseDreamWindow', () => {
  test('valid "H-H" parses; unset/empty → default silently', () => {
    expect(parseDreamWindow('22-7')).toEqual({ startHour: 22, endHour: 7 });
    expect(parseDreamWindow(undefined)).toEqual(DEFAULT_DREAM_WINDOW);
    expect(parseDreamWindow('')).toEqual(DEFAULT_DREAM_WINDOW);
  });

  test('garbage, out-of-range, and degenerate equal hours → default with one warn', () => {
    for (const bad of ['foo', '25-3', '21-24', '21-21', '9-']) {
      const warns: string[] = [];
      expect(parseDreamWindow(bad, (m) => warns.push(m))).toEqual(DEFAULT_DREAM_WINDOW);
      expect(warns.length).toBe(1);
    }
  });
});

describe('the composed decision (flag && !dreaming && due && windowOpen)', () => {
  test('daytime + never-dreamt → NO dream (D1 includes the first ever)', () => {
    const noon = local(12);
    expect(shutdownDreamDue(null, noon, SIX_H) && dreamWindowOpen(noon)).toBe(false);
  });

  test('night + due → dream; night + not-due → no dream', () => {
    const night = local(23);
    expect(shutdownDreamDue(night - 7 * 3_600_000, night, SIX_H) && dreamWindowOpen(night)).toBe(true);
    expect(shutdownDreamDue(night - 3_600_000, night, SIX_H) && dreamWindowOpen(night)).toBe(false);
  });

  test('minGap 0 keeps always-due semantics but stays window-bound', () => {
    expect(shutdownDreamDue(local(11, 59), local(12), 0) && dreamWindowOpen(local(12))).toBe(false);
    expect(shutdownDreamDue(local(22, 59), local(23), 0) && dreamWindowOpen(local(23))).toBe(true);
  });
});
