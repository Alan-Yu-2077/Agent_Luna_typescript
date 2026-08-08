// Vendored from ~/Desktop/luna-music-cli (upstream re-vendor 2026-08-08: 37 tests green, +enrich/library/lyrics; prior live-verify 2026-08-07).
/**
 * Stable contract consumed by Luna.
 *
 * Nothing downstream of `adapter.ts` may import media-control's raw JSON shape.
 * The upstream project warns that "the API may experience breaking changes
 * across minor revisions" — this file is the firewall against that.
 */

/** A normalised snapshot of whatever the system is currently playing. */
export interface NowPlaying {
  /**
   * Stable identity for "is this the same song", derived from title/artist/album.
   *
   * Deliberately NOT the player's own item identifier: NeteaseMusic.app mints a
   * fresh `contentItemIdentifier` on every play/pause cycle of the same track
   * (verified over three cycles — three different UUIDs), so using it would fire
   * a spurious track-change every time playback resumes.
   */
  id: string;
  /** The player's per-session item id. Unstable — debugging only, never identity. */
  sessionId: string | null;
  title: string;
  artist: string;
  album: string;
  /** Seconds. `null` when the player does not report it. */
  duration: number | null;
  /** Seconds into the track at `sampledAt`. */
  position: number;
  playing: boolean;
  /** 0 when paused, 1 at normal speed. Used to extrapolate position. */
  playbackRate: number;
  /** e.g. `com.netease.163music`. */
  source: string;
  sourceName: SourceName;
  /** sha256 prefix of the artwork bytes — cheap change detection. */
  artworkHash: string | null;
  /** Absolute path, only when `--artwork <dir>` was passed. */
  artworkPath: string | null;
  liked: boolean | null;
  shuffle: boolean | null;
  repeat: boolean | null;
  /** ISO-8601. When this snapshot was taken. */
  sampledAt: string;
}

export type SourceName = "netease" | "apple-music" | "spotify" | "browser" | "other";

export const NETEASE_BUNDLE_ID = "com.netease.163music";

const SOURCE_NAMES: Record<string, SourceName> = {
  [NETEASE_BUNDLE_ID]: "netease",
  "com.apple.Music": "apple-music",
  "com.spotify.client": "spotify",
  "com.google.Chrome": "browser",
  "com.apple.Safari": "browser",
};

export function sourceNameOf(bundleId: string): SourceName {
  return SOURCE_NAMES[bundleId] ?? "other";
}

/** Semantic events emitted by `watch`. One JSON object per line (NDJSON). */
export type MusicEvent =
  /** A different song started. This is the proactive-turn trigger. */
  | { event: "track"; track: NowPlaying }
  /** Play/pause flipped on the same song. */
  | { event: "state"; playing: boolean; position: number; track: NowPlaying }
  /** No player is reporting anything. */
  | { event: "stopped"; at: string };

// ── Perception layer ──────────────────────────────────────────────────────
// Everything below is observation, never control: what Luna can *know* about
// your listening, so she can listen along rather than drive.

/** A track as it exists in the local NetEase library cache. */
export interface LibraryTrack {
  /** NetEase's own numeric song id — the join key for lyrics and playlists. */
  neteaseId: string;
  title: string;
  artist: string;
  album: string;
  durationMs: number | null;
  coverUrl: string | null;
  /** 0 free · 1 VIP-only · 8 low-bitrate-free. Lets Luna know if it's a VIP pick. */
  fee: number | null;
}

/**
 * Your relationship with one track, from the client's own play accounting.
 * This is the material for "you've had this on a lot lately".
 */
export interface TrackAffinity {
  neteaseId: string;
  /** Number of recorded play sessions. */
  sessions: number;
  /** Accumulated listening time in seconds across all sessions. */
  listenedSeconds: number;
  /** Where this track sits in your all-time most-listened ranking (1 = top). */
  rank: number | null;
}

/** A saved playlist, from the local cache. */
export interface Playlist {
  id: string;
  name: string;
  /** Track count when known; null when the cache only stored the header. */
  trackCount: number | null;
}

/** One timestamped lyric line, optionally with a translation. */
export interface LyricLine {
  /** Milliseconds from the start of the track. */
  timeMs: number;
  text: string;
  /** Translated line, when the track has one. */
  translation: string | null;
}

/** A track's full lyrics, parsed and time-indexed. */
export interface Lyrics {
  neteaseId: string;
  lines: LyricLine[];
  hasTranslation: boolean;
  /** Not every track has synced (timestamped) lyrics; some are plain text. */
  synced: boolean;
}

/** Where the lyric playhead is right now — the heart of listening along. */
export interface LyricPosition {
  /** The line playing now, or null before the first line. */
  current: LyricLine | null;
  /** The line coming up, or null at the end. */
  next: LyricLine | null;
  /** Index of `current` within `lines`, or -1. */
  index: number;
}

/**
 * The full picture Luna sees at a glance: what's playing, your history with it,
 * and the words on screen right now. This is the perception payload.
 */
export interface EnrichedNowPlaying extends NowPlaying {
  /** Resolved NetEase id, when the current title matched the local library. */
  neteaseId: string | null;
  affinity: TrackAffinity | null;
  lyric: LyricPosition | null;
}

/** Playback commands, mapped to MediaRemote integer codes in `control.ts`. */
export type Command =
  | "play"
  | "pause"
  | "toggle"
  | "stop"
  | "next"
  | "prev"
  | "shuffle"
  | "repeat"
  | "back15"
  | "skip15";
