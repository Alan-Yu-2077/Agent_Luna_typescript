// Vendored from ~/Desktop/luna-music-cli (built + live-verified 2026-08-07: macOS 26.5.2, NeteaseMusic 3.1.8.3368, media-control 0.7.6).
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
export type { NowPlaying, MusicEvent, Command, SourceName } from "./types";
export { NETEASE_BUNDLE_ID, sourceNameOf } from "./types";
