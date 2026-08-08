// Vendored from ~/Desktop/luna-music-cli (built + live-verified 2026-08-07: macOS 26.5.2, NeteaseMusic 3.1.8.3368, media-control 0.7.6).
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
