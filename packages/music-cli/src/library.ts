// Vendored from ~/Desktop/luna-music-cli (upstream re-vendor 2026-08-08: 37 tests green, +enrich/library/lyrics; prior live-verify 2026-08-07).
/**
 * The ONLY module that knows the NetEase client's local SQLite schema.
 *
 * The desktop client keeps a cache at
 *   ~/Library/Containers/com.netease.163music/Data/Documents/storage/
 *     sqlite_storage.sqlite3
 * holding track metadata, play history, play accounting and playlists. This is
 * a private, undocumented schema that can change on any client update, so — as
 * with `adapter.ts` and media-control — every table and JSON field lives behind
 * this file and nothing leaves except the stable contracts in `types.ts`.
 *
 * Opened READ-ONLY, always. The client writes this DB while it runs; we only
 * ever observe it. Never open it writable.
 */

import { Database } from "bun:sqlite";
import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { LibraryTrack, TrackAffinity, Playlist } from "./types";

const DEFAULT_DB = join(
  homedir(),
  "Library/Containers/com.netease.163music/Data/Documents/storage/sqlite_storage.sqlite3",
);

/** Resolve the DB path: explicit override, then the standard container location. */
export function libraryPath(): string {
  return process.env.LUNA_MUSIC_DB ?? DEFAULT_DB;
}

export function libraryExists(): boolean {
  return existsSync(libraryPath());
}

interface RawDbTrack {
  id?: string;
  name?: string;
  album?: { name?: string; picUrl?: string };
  artists?: { name?: string }[];
  duration?: number;
  fee?: number;
}

function toLibraryTrack(id: string, json: string): LibraryTrack | null {
  let raw: RawDbTrack;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  return {
    neteaseId: raw.id ?? id,
    title: raw.name ?? "",
    artist: (raw.artists ?? []).map((a) => a.name).filter(Boolean).join(", "),
    album: raw.album?.name ?? "",
    durationMs: typeof raw.duration === "number" ? raw.duration : null,
    coverUrl: raw.album?.picUrl ?? null,
    fee: typeof raw.fee === "number" ? raw.fee : null,
  };
}

/**
 * Read-only view over the client's local cache.
 *
 * Construct once, call methods, `close()`. Every method degrades to
 * empty/null if the DB is absent rather than throwing, so Luna can mount the
 * perception layer optimistically and simply get less when the client has
 * never run.
 */
export class Library {
  private db: Database | null = null;

  constructor(path: string = libraryPath()) {
    if (!existsSync(path)) return;
    // `readonly` plus immutable-friendly access; the client owns writes.
    this.db = new Database(path, { readonly: true });
  }

  get available(): boolean {
    return this.db !== null;
  }

  close(): void {
    this.db?.close();
    this.db = null;
  }

  /**
   * Map a now-playing title (+ optional artist) to its NetEase id. media-control
   * never reports the id, so title is the only bridge from "what's playing" to
   * lyrics and affinity. Artist disambiguates covers and same-named tracks.
   */
  resolveId(title: string, artist?: string): string | null {
    if (!this.db || !title) return null;
    const rows = this.db
      .query<{ id: string; json: string }, [string]>(
        `SELECT id, jsonStr AS json FROM dbTrack
         WHERE lower(json_extract(jsonStr,'$.name')) = lower(?)`,
      )
      .all(title);
    if (rows.length === 0) return null;
    if (rows.length === 1 || !artist) return rows[0]!.id;

    const want = artist.toLowerCase();
    for (const r of rows) {
      const t = toLibraryTrack(r.id, r.json);
      if (t && t.artist.toLowerCase().includes(want)) return r.id;
    }
    return rows[0]!.id;
  }

  /** Full metadata for one track. */
  track(neteaseId: string): LibraryTrack | null {
    if (!this.db) return null;
    const row = this.db
      .query<{ id: string; json: string }, [string]>(
        `SELECT id, jsonStr AS json FROM dbTrack WHERE id = ?`,
      )
      .get(neteaseId);
    return row ? toLibraryTrack(row.id, row.json) : null;
  }

  /** Case-insensitive substring search across title, artist and album. */
  search(query: string, limit = 20): LibraryTrack[] {
    if (!this.db || !query.trim()) return [];
    const like = `%${query.trim()}%`;
    const rows = this.db
      .query<{ id: string; json: string }, [string, number]>(
        `SELECT id, jsonStr AS json FROM dbTrack
         WHERE jsonStr LIKE ? COLLATE NOCASE
         LIMIT ?`,
      )
      .all(like, limit);
    return rows.map((r) => toLibraryTrack(r.id, r.json)).filter((t): t is LibraryTrack => t !== null);
  }

  /**
   * Your relationship with one track: play sessions, accumulated listening
   * time, and all-time rank. `playingCount` holds one row per play session, so
   * both are aggregated per resourceId.
   */
  affinity(neteaseId: string): TrackAffinity | null {
    if (!this.db) return null;
    const agg = this.db
      .query<{ sessions: number; total: number | null }, [string]>(
        `SELECT COUNT(*) AS sessions, SUM(playDuration) AS total
         FROM playingCount WHERE resourceId = ?`,
      )
      .get(neteaseId);
    if (!agg || agg.sessions === 0) {
      return { neteaseId, sessions: 0, listenedSeconds: 0, rank: null };
    }
    // Rank = how many distinct tracks you've listened to more than this one.
    const rankRow = this.db
      .query<{ rank: number }, [string]>(
        `WITH totals AS (
           SELECT resourceId, SUM(playDuration) AS d
           FROM playingCount GROUP BY resourceId
         )
         SELECT 1 + COUNT(*) AS rank FROM totals
         WHERE d > (SELECT d FROM totals WHERE resourceId = ?)`,
      )
      .get(neteaseId);
    return {
      neteaseId,
      sessions: agg.sessions,
      listenedSeconds: Math.round(agg.total ?? 0),
      rank: rankRow?.rank ?? null,
    };
  }

  /** Your most-listened tracks, by accumulated time. */
  top(limit = 10): (LibraryTrack & { listenedSeconds: number; sessions: number })[] {
    if (!this.db) return [];
    const rows = this.db
      .query<{ id: string; json: string; total: number; sessions: number }, [number]>(
        `SELECT t.id AS id, t.jsonStr AS json,
                SUM(p.playDuration) AS total, COUNT(*) AS sessions
         FROM playingCount p JOIN dbTrack t ON t.id = p.resourceId
         GROUP BY p.resourceId
         ORDER BY total DESC
         LIMIT ?`,
      )
      .all(limit);
    return rows
      .map((r) => {
        const t = toLibraryTrack(r.id, r.json);
        return t ? { ...t, listenedSeconds: Math.round(r.total), sessions: r.sessions } : null;
      })
      .filter((t): t is LibraryTrack & { listenedSeconds: number; sessions: number } => t !== null);
  }

  /** Recently played tracks, most recent first. */
  history(limit = 20): (LibraryTrack & { playedAt: number | null })[] {
    if (!this.db) return [];
    const rows = this.db
      .query<{ id: string; json: string; playtime: number | null }, [number]>(
        `SELECT id, jsonStr AS json, playtime FROM historyTracks
         ORDER BY playtime DESC LIMIT ?`,
      )
      .all(limit);
    return rows
      .map((r) => {
        const t = toLibraryTrack(r.id, r.json);
        return t ? { ...t, playedAt: r.playtime } : null;
      })
      .filter((t): t is LibraryTrack & { playedAt: number | null } => t !== null);
  }

  /** Saved / recently visited playlists. */
  playlists(): Playlist[] {
    if (!this.db) return [];
    const rows = this.db
      .query<{ json: string }, []>(`SELECT jsonStr AS json FROM historyPlaylists`)
      .all();
    const out: Playlist[] = [];
    for (const r of rows) {
      try {
        const d = JSON.parse(r.json);
        if (!d?.id) continue;
        out.push({
          id: String(d.id),
          name: d.name ?? "",
          trackCount: typeof d.trackCount === "number" ? d.trackCount : null,
        });
      } catch {
        /* skip malformed row */
      }
    }
    return out;
  }
}
