import { describe, expect, test } from 'bun:test';
import {
  EXIT_GRACE_MS,
  POLL_MS,
  artworkUrl,
  extrapolate,
  fmtTime,
  monotonic,
  shouldExit,
} from './playerCard';

// v0.45.4 — the card's pure mechanics: 4s-poll extrapolation that never runs past the end,
// display progress that never jumps backwards mid-track, the 2.5s exit grace, and the artwork
// URL that only ever varies by an encoded hash.

describe('extrapolate', () => {
  test('playing advances by wall clock; paused stays put', () => {
    const snap = { position: 30, playing: true, duration: 200 };
    expect(extrapolate(snap, 1000, 3000)).toBe(32);
    expect(extrapolate({ ...snap, playing: false }, 1000, 9000)).toBe(30);
  });

  test('clamped to duration; unbounded when duration unknown', () => {
    expect(extrapolate({ position: 198, playing: true, duration: 200 }, 0, 10_000)).toBe(200);
    expect(extrapolate({ position: 198, playing: true, duration: null }, 0, 10_000)).toBe(208);
  });
});

describe('monotonic display', () => {
  test('a small poll correction backwards is held; forward always wins', () => {
    expect(monotonic(45, 44.2, true)).toBe(45); // ≤2s regression → hold
    expect(monotonic(45, 47, true)).toBe(47);
  });

  test('a genuine rewind (>2s) is honored; a track change always resets', () => {
    expect(monotonic(120, 5, true)).toBe(5);
    expect(monotonic(120, 118.5, false)).toBe(118.5);
  });
});

describe('exit grace', () => {
  test('null must persist the full grace before the card leaves', () => {
    expect(shouldExit(null, 99_999)).toBe(false);
    expect(shouldExit(1000, 1000 + EXIT_GRACE_MS - 1)).toBe(false);
    expect(shouldExit(1000, 1000 + EXIT_GRACE_MS)).toBe(true);
  });

  test('the grace covers a track-change gap at the poll cadence', () => {
    // A between-songs gap is shorter than one poll; the card must not blink out.
    expect(EXIT_GRACE_MS).toBeLessThan(POLL_MS);
  });
});

describe('formatting and artwork', () => {
  test('fmtTime', () => {
    expect(fmtTime(0)).toBe('0:00');
    expect(fmtTime(65)).toBe('1:05');
    expect(fmtTime(null)).toBe('-:--');
  });

  test('artwork url is hash-encoded, null-safe', () => {
    expect(artworkUrl(null)).toBeNull();
    expect(artworkUrl('abc123')).toBe('/api/music/artwork?h=abc123');
    expect(artworkUrl('a/b')).toBe('/api/music/artwork?h=a%2Fb');
  });
});
