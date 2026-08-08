// Vendored from ~/Desktop/luna-music-cli (upstream re-vendor 2026-08-08: 37 tests green, +enrich/library/lyrics; prior live-verify 2026-08-07).
import { describe, expect, test } from "bun:test";
import { normalise, positionAt, isSameTrack, isEmpty } from "../src/index";
import type { RawPayload } from "../src/index";

/** Captured verbatim from `media-control get` against NeteaseMusic.app 3.1.8. */
const REAL: RawPayload = {
  playbackRate: 0,
  album: "DJ MAX Trilogy O.S.T",
  elapsedTime: 140.01362811791384,
  timestamp: "2026-08-07T09:01:54Z",
  bundleIdentifier: "com.netease.163music",
  processIdentifier: 673,
  artworkData: Buffer.from("fake-jpeg-bytes").toString("base64"),
  title: "My jealousy (Original ver.)",
  artworkMimeType: "image/jpeg",
  artist: "DJMAX",
  contentItemIdentifier: "9A015DA1-A689-4AE7-9348-FF153A3A9477",
  playing: false,
} as RawPayload;

describe("isEmpty", () => {
  test("treats the stream's empty payload as nothing playing", () => {
    expect(isEmpty({})).toBe(true);
    expect(isEmpty(null)).toBe(true);
    expect(isEmpty({ playbackRate: 0 })).toBe(true);
    expect(isEmpty(REAL)).toBe(false);
  });
});

describe("normalise", () => {
  test("maps the real NetEase payload onto the contract", () => {
    const t = normalise(REAL);
    expect(t.title).toBe("My jealousy (Original ver.)");
    expect(t.artist).toBe("DJMAX");
    expect(t.album).toBe("DJ MAX Trilogy O.S.T");
    expect(t.source).toBe("com.netease.163music");
    expect(t.sourceName).toBe("netease");
    expect(t.playing).toBe(false);
    expect(t.position).toBeCloseTo(140.01, 1);
  });

  test("never leaks artwork bytes into the contract", () => {
    const t = normalise(REAL);
    expect(JSON.stringify(t)).not.toContain(REAL.artworkData);
    expect(t.artworkHash).toMatch(/^[0-9a-f]{16}$/);
    expect(t.artworkPath).toBeNull();
  });

  test("infers playing from playbackRate when the flag is absent", () => {
    const { playing, ...noFlag } = REAL;
    expect(normalise({ ...noFlag, playbackRate: 1 }).playing).toBe(true);
    expect(normalise({ ...noFlag, playbackRate: 0 }).playing).toBe(false);
  });

  /**
   * Regression: mid-transition NetEase emits a snapshot whose `playing` flag
   * contradicts its `playbackRate`. Observed live as the middle of these three.
   * Believing `playing` produced ~20 spurious state flips for 4 real commands.
   */
  test("trusts playbackRate over a contradicting playing flag", () => {
    const observed = [
      { playing: true, playbackRate: 1 },
      { playing: false, playbackRate: 1 }, // the liar
      { playing: false, playbackRate: 0 },
    ];
    const states = observed.map((o) => normalise({ ...REAL, ...o }).playing);
    expect(states).toEqual([true, true, false]);
  });

  test("falls back to the playing flag when no rate is reported", () => {
    const { playbackRate, ...noRate } = REAL;
    expect(normalise({ ...noRate, playing: true }).playing).toBe(true);
    expect(normalise({ ...noRate, playing: false }).playing).toBe(false);
    expect(normalise({ title: "x" }).playing).toBe(false);
  });

  test("reports a missing duration as null rather than 0", () => {
    expect(normalise(REAL).duration).toBeNull();
    expect(normalise({ ...REAL, duration: 210 }).duration).toBe(210);
  });

  test("survives a payload with nothing but a title", () => {
    const t = normalise({ title: "x" });
    expect(t.artist).toBe("");
    expect(t.source).toBe("unknown");
    expect(t.sourceName).toBe("other");
  });
});

describe("positionAt", () => {
  const sampledAt = "2026-08-07T09:00:00Z";
  const at = (s: number) => new Date(Date.parse(sampledAt) + s * 1000);

  test("holds still while paused", () => {
    const t = normalise({ ...REAL, timestamp: sampledAt, playbackRate: 0, playing: false });
    expect(positionAt(t, at(30))).toBeCloseTo(140.01, 1);
  });

  test("extrapolates while playing so lyrics can track without polling", () => {
    const t = normalise({ ...REAL, timestamp: sampledAt, playbackRate: 1, playing: true });
    expect(positionAt(t, at(30))).toBeCloseTo(170.01, 1);
  });

  test("never runs past a known duration", () => {
    const t = normalise({ ...REAL, timestamp: sampledAt, playbackRate: 1, playing: true, duration: 150 });
    expect(positionAt(t, at(600))).toBe(150);
  });
});

describe("isSameTrack", () => {
  test("pause/resume of one song is not a track change", () => {
    expect(isSameTrack(normalise(REAL), normalise({ ...REAL, playbackRate: 1, elapsedTime: 9 }))).toBe(true);
  });

  /**
   * Regression: NeteaseMusic.app hands out a new contentItemIdentifier on every
   * play/pause cycle. These three UUIDs are the real ones observed across three
   * cycles of one track. Keying identity off them made Luna announce a "new
   * song" every time playback resumed.
   */
  test("survives NetEase reissuing contentItemIdentifier for the same song", () => {
    const observed = [
      "1796CF0E-F57F-4B40-A299-4593B41F1408",
      "4EEEC79F-78EE-4839-BBCA-60C3586CCDFA",
      "5DF07769-68F8-4F7F-9003-B64184F56D4F",
    ].map((contentItemIdentifier) => normalise({ ...REAL, contentItemIdentifier }));

    const first = observed[0]!;
    for (const t of observed) expect(isSameTrack(first, t)).toBe(true);
    expect(new Set(observed.map((t) => t.id)).size).toBe(1);
    // …while still surfacing the volatile value for debugging.
    expect(new Set(observed.map((t) => t.sessionId)).size).toBe(3);
  });

  test("a different song is a change", () => {
    const other = { ...REAL, title: "Other", contentItemIdentifier: "B-2" };
    expect(isSameTrack(normalise(REAL), normalise(other))).toBe(false);
  });

  test("the same title in a different app is a change", () => {
    const elsewhere = { ...REAL, bundleIdentifier: "com.apple.Music" };
    expect(isSameTrack(normalise(REAL), normalise(elsewhere))).toBe(false);
  });

  test("null is never the same as a track", () => {
    expect(isSameTrack(null, normalise(REAL))).toBe(false);
    expect(isSameTrack(null, null)).toBe(false);
  });
});
