import { describe, expect, test } from 'bun:test';
import { shutdownDreamDue } from './dreamState';

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
