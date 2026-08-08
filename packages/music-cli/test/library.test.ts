// Vendored from ~/Desktop/luna-music-cli (upstream re-vendor 2026-08-08: 37 tests green, +enrich/library/lyrics; prior live-verify 2026-08-07).
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync } from "node:fs";
import { Library } from "../src/index";

/**
 * Build a throwaway DB mirroring the real NetEase schema (dbTrack, playingCount,
 * historyTracks, historyPlaylists), so Library is tested against the exact
 * shapes it parses — without touching the user's live client cache.
 */
const DB_PATH = join(tmpdir(), `luna-music-test-${process.pid}.sqlite3`);

function track(id: string, name: string, artist: string, fee = 0) {
  return JSON.stringify({
    id,
    name,
    fee,
    duration: 200000,
    artists: [{ name: artist }],
    album: { name: `${name} - album`, picUrl: `http://p.music.126.net/${id}.jpg` },
  });
}

beforeAll(() => {
  const db = new Database(DB_PATH);
  db.run(`CREATE TABLE dbTrack (id VARCHAR(40) PRIMARY KEY, jsonStr TEXT)`);
  db.run(`CREATE TABLE playingCount (resourceId VARCHAR(40), playDuration BIGINT, id INTEGER PRIMARY KEY AUTOINCREMENT)`);
  db.run(`CREATE TABLE historyTracks (playtime BIGINT, id VARCHAR(40) PRIMARY KEY, jsonStr TEXT)`);
  db.run(`CREATE TABLE historyPlaylists (playtime BIGINT, id VARCHAR(40) PRIMARY KEY, jsonStr TEXT)`);

  db.run(`INSERT INTO dbTrack VALUES (?,?)`, ["100", track("100", "Supernatural", "noli", 1)]);
  db.run(`INSERT INTO dbTrack VALUES (?,?)`, ["200", track("200", "Mihe Dance", "vanbird", 8)]);
  db.run(`INSERT INTO dbTrack VALUES (?,?)`, ["300", track("300", "Do For Love", "2Pac", 1)]);
  // Two same-named tracks by different artists — resolveId must disambiguate.
  db.run(`INSERT INTO dbTrack VALUES (?,?)`, ["400", track("400", "Rover", "S1mba")]);
  db.run(`INSERT INTO dbTrack VALUES (?,?)`, ["401", track("401", "Rover", "Lil Tecca")]);

  // Supernatural: two sessions summing to 600s. Mihe Dance: one 100s session.
  db.run(`INSERT INTO playingCount (resourceId, playDuration) VALUES ('100', 500)`);
  db.run(`INSERT INTO playingCount (resourceId, playDuration) VALUES ('100', 100)`);
  db.run(`INSERT INTO playingCount (resourceId, playDuration) VALUES ('200', 100)`);

  db.run(`INSERT INTO historyTracks VALUES (?,?,?)`, [2000, "200", track("200", "Mihe Dance", "vanbird", 8)]);
  db.run(`INSERT INTO historyTracks VALUES (?,?,?)`, [1000, "100", track("100", "Supernatural", "noli", 1)]);

  db.run(`INSERT INTO historyPlaylists VALUES (?,?,?)`, [1, "9001", JSON.stringify({ id: "9001", name: "学习的vibe", trackCount: 13 })]);
  db.run(`INSERT INTO historyPlaylists VALUES (?,?,?)`, [2, "9002", JSON.stringify({ id: "9002", name: "light的vibe" })]);
  db.close();
});

afterAll(() => {
  for (const suffix of ["", "-shm", "-wal"]) rmSync(DB_PATH + suffix, { force: true });
});

describe("Library", () => {
  test("opens read-only and reports availability", () => {
    const lib = new Library(DB_PATH);
    expect(lib.available).toBe(true);
    lib.close();
  });

  test("missing DB degrades to unavailable, never throws", () => {
    const lib = new Library("/no/such/path.sqlite3");
    expect(lib.available).toBe(false);
    expect(lib.search("x")).toEqual([]);
    expect(lib.top()).toEqual([]);
    expect(lib.affinity("100")).toBeNull();
    expect(lib.resolveId("Supernatural")).toBeNull();
    lib.close();
  });

  test("resolveId matches by title, case-insensitively", () => {
    const lib = new Library(DB_PATH);
    expect(lib.resolveId("supernatural")).toBe("100");
    lib.close();
  });

  test("resolveId disambiguates same-named tracks by artist", () => {
    const lib = new Library(DB_PATH);
    expect(lib.resolveId("Rover", "Lil Tecca")).toBe("401");
    expect(lib.resolveId("Rover", "S1mba")).toBe("400");
    lib.close();
  });

  test("affinity aggregates sessions and listening time, with rank", () => {
    const lib = new Library(DB_PATH);
    const a = lib.affinity("100");
    expect(a).toEqual({ neteaseId: "100", sessions: 2, listenedSeconds: 600, rank: 1 });
    // Mihe Dance is less-listened → rank 2.
    expect(lib.affinity("200")?.rank).toBe(2);
    lib.close();
  });

  test("affinity of a never-played track is zero, not null", () => {
    const lib = new Library(DB_PATH);
    expect(lib.affinity("300")).toEqual({ neteaseId: "300", sessions: 0, listenedSeconds: 0, rank: null });
    lib.close();
  });

  test("top ranks by accumulated listening time", () => {
    const lib = new Library(DB_PATH);
    const top = lib.top();
    expect(top.map((t) => t.title)).toEqual(["Supernatural", "Mihe Dance"]);
    expect(top[0]!.listenedSeconds).toBe(600);
    expect(top[0]!.sessions).toBe(2);
    lib.close();
  });

  test("search matches title/artist/album and exposes fee", () => {
    const lib = new Library(DB_PATH);
    const hits = lib.search("love");
    expect(hits.map((t) => t.title)).toContain("Do For Love");
    expect(hits.find((t) => t.title === "Do For Love")?.fee).toBe(1);
    lib.close();
  });

  test("history is newest-first", () => {
    const lib = new Library(DB_PATH);
    expect(lib.history().map((t) => t.title)).toEqual(["Mihe Dance", "Supernatural"]);
    lib.close();
  });

  test("playlists tolerate a missing trackCount", () => {
    const lib = new Library(DB_PATH);
    const pl = lib.playlists();
    expect(pl.find((p) => p.id === "9001")).toEqual({ id: "9001", name: "学习的vibe", trackCount: 13 });
    expect(pl.find((p) => p.id === "9002")?.trackCount).toBeNull();
    lib.close();
  });

  test("track() returns full metadata including cover", () => {
    const lib = new Library(DB_PATH);
    const t = lib.track("100");
    expect(t?.artist).toBe("noli");
    expect(t?.coverUrl).toContain("126.net");
    lib.close();
  });
});
