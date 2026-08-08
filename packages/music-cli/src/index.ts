// Vendored from ~/Desktop/luna-music-cli (upstream re-vendor 2026-08-08: 37 tests green, +enrich/library/lyrics; prior live-verify 2026-08-07).
/**
 * Module surface for Luna.
 *
 * Prefer importing this over spawning the CLI: Luna is Bun/TS, so the tool and
 * the ambient-context provider can share one in-process `watch()` subscription
 * instead of paying a subprocess per read.
 */

export { now, send, doctor, MediaControlMissingError, BIN } from "./control";
export type { Diagnosis } from "./control";
export { watch } from "./watch";
export type { WatchOptions } from "./watch";
export { normalise, positionAt, isSameTrack, isEmpty, trackIdentity } from "./adapter";
export type { RawPayload, NormaliseOptions } from "./adapter";

// Perception layer
export { Library, libraryPath, libraryExists } from "./library";
export { fetchLyrics, parseLrc, lineAt } from "./lyrics";
export { enrich } from "./enrich";
export type { EnrichOptions } from "./enrich";

export type {
  NowPlaying,
  MusicEvent,
  Command,
  SourceName,
  LibraryTrack,
  TrackAffinity,
  Playlist,
  LyricLine,
  Lyrics,
  LyricPosition,
  EnrichedNowPlaying,
} from "./types";
export { NETEASE_BUNDLE_ID, sourceNameOf } from "./types";
