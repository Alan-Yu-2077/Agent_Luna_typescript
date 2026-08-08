// Vendored from ~/Desktop/luna-music-cli (upstream re-vendor 2026-08-08: 37 tests green, +enrich/library/lyrics; prior live-verify 2026-08-07).
import { describe, expect, test } from "bun:test";
import { parseLrc, lineAt } from "../src/index";
import type { Lyrics } from "../src/index";

/** Trimmed from the real 2TONE lyric body returned by the endpoint. */
const REAL_LRC = `[00:00.000] 作词 : Jahaan Sweet
[00:09.932] Nobody wants to be cool as her
[01:07.182] But goddamn it, I love that bitch
[01:08.704] In the backseat`;

describe("parseLrc", () => {
  test("parses timestamps into milliseconds", () => {
    const { lines, synced } = parseLrc(REAL_LRC);
    expect(synced).toBe(true);
    expect(lines[0]).toEqual({ timeMs: 0, text: "作词 : Jahaan Sweet" });
    expect(lines[1]!.timeMs).toBe(9932);
    // 01:07.182 → 67182ms — the line that was playing in the live test.
    expect(lines[2]!.timeMs).toBe(67182);
    expect(lines[2]!.text).toBe("But goddamn it, I love that bitch");
  });

  test("returns lines sorted by time", () => {
    const { lines } = parseLrc("[00:30.000]late\n[00:10.000]early");
    expect(lines.map((l) => l.text)).toEqual(["early", "late"]);
  });

  test("pads fractional seconds correctly (.5 = 500ms, not 5ms)", () => {
    expect(parseLrc("[00:01.5]x").lines[0]!.timeMs).toBe(1500);
    expect(parseLrc("[00:01.50]x").lines[0]!.timeMs).toBe(1500);
    expect(parseLrc("[00:01.500]x").lines[0]!.timeMs).toBe(1500);
  });

  test("drops empty and untimed lines from the synced view", () => {
    const { lines } = parseLrc("[00:01.000]\n[00:02.000]real\nplain text no tag");
    expect(lines).toEqual([{ timeMs: 2000, text: "real" }]);
  });

  test("marks plain-text lyrics as unsynced", () => {
    const { lines, synced } = parseLrc("just some words\nno timestamps here");
    expect(synced).toBe(false);
    expect(lines).toEqual([]);
  });
});

describe("lineAt", () => {
  const lyrics: Lyrics = {
    neteaseId: "x",
    hasTranslation: false,
    synced: true,
    lines: [
      { timeMs: 0, text: "a", translation: null },
      { timeMs: 10_000, text: "b", translation: null },
      { timeMs: 20_000, text: "c", translation: null },
    ],
  };

  test("finds the line playing at a given position", () => {
    expect(lineAt(lyrics, 12_000).current?.text).toBe("b");
    expect(lineAt(lyrics, 12_000).next?.text).toBe("c");
    expect(lineAt(lyrics, 12_000).index).toBe(1);
  });

  test("returns null current before the first line", () => {
    const pos = lineAt(lyrics, -5);
    expect(pos.current).toBeNull();
    expect(pos.next?.text).toBe("a");
    expect(pos.index).toBe(-1);
  });

  test("holds the last line with no next after the end", () => {
    const pos = lineAt(lyrics, 999_000);
    expect(pos.current?.text).toBe("c");
    expect(pos.next).toBeNull();
  });

  test("lands exactly on a line boundary", () => {
    expect(lineAt(lyrics, 10_000).current?.text).toBe("b");
  });

  test("empty lyrics never crash", () => {
    const empty: Lyrics = { neteaseId: "x", hasTranslation: false, synced: false, lines: [] };
    expect(lineAt(empty, 5000)).toEqual({ current: null, next: null, index: -1 });
  });
});
