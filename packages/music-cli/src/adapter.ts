// Vendored from ~/Desktop/luna-music-cli (built + live-verified 2026-08-07: macOS 26.5.2, NeteaseMusic 3.1.8.3368, media-control 0.7.6).
/**
 * The ONLY module that knows media-control's JSON shape.
 *
 * `media-control` (github.com/ungive/media-control, Homebrew formula) shells out
 * to the MediaRemote framework. Its README carries an explicit stability warning,
 * so every field access is defensive and everything leaves through `NowPlaying`.
 */

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NowPlaying, sourceNameOf } from "./types";

/** Raw media-control payload. Every field optional — the player decides what it reports. */
export interface RawPayload {
  title?: string;
  artist?: string;
  album?: string;
  duration?: number;
  elapsedTime?: number;
  playing?: boolean;
  playbackRate?: number;
  bundleIdentifier?: string;
  parentApplicationBundleIdentifier?: string;
  contentItemIdentifier?: string;
  artworkData?: string;
  artworkMimeType?: string;
  isLiked?: boolean;
  shuffleMode?: number | boolean;
  repeatMode?: number | boolean;
  timestamp?: string;
}

export interface NormaliseOptions {
  /** When set, artwork bytes are written here and `artworkPath` is populated. */
  artworkDir?: string;
}

/** `{}` or a payload with no title/artist means nothing is playing. */
export function isEmpty(raw: RawPayload | null | undefined): boolean {
  if (!raw) return true;
  if (Object.keys(raw).length === 0) return true;
  return !raw.title && !raw.artist;
}

/**
 * Identity for "is this the same song".
 *
 * Derived from metadata rather than the player's own item id, because
 * NeteaseMusic.app mints a fresh `contentItemIdentifier` on every play/pause
 * cycle of the same track. Verified over three cycles of one song:
 *   1796CF0E-…, 4EEEC79F-…, 5DF07769-…
 * Trusting it would fire a track-change event every time playback resumes.
 *
 * NUL-joined so a title containing the separator cannot forge a collision.
 */
export function trackIdentity(title: string, artist: string, album: string): string {
  const key = [title, artist, album].map((s) => s.trim().toLowerCase()).join("\u0000");
  return createHash("sha256").update(key).digest("hex").slice(0, 16);
}

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function toBool(v: number | boolean | undefined): boolean | null {
  if (v === undefined) return null;
  return typeof v === "number" ? v !== 0 : v;
}

/**
 * `playbackRate` wins over the `playing` flag.
 *
 * During a transition NetEase emits a snapshot where the two disagree —
 * observed live as `{playing: false, playbackRate: 1}` sandwiched between two
 * consistent ones. Trusting `playing` made the watcher emit a play/pause storm
 * (twenty state flips for four real commands). The rate is the speed the track
 * is actually advancing at, so it is the honest signal; `playing` is only the
 * fallback for players that omit a rate.
 */
function derivePlaying(raw: RawPayload): boolean {
  if (typeof raw.playbackRate === "number") return raw.playbackRate > 0;
  return raw.playing ?? false;
}

/**
 * Collapse a raw payload into the stable contract.
 *
 * `artworkData` is base64 JPEG and routinely tens of kilobytes — it is NEVER
 * carried through. Luna gets a hash for change detection and, optionally, a path.
 */
export function normalise(raw: RawPayload, opts: NormaliseOptions = {}): NowPlaying {
  const title = raw.title ?? "";
  const artist = raw.artist ?? "";
  const album = raw.album ?? "";
  const source = raw.bundleIdentifier ?? raw.parentApplicationBundleIdentifier ?? "unknown";

  let artworkHash: string | null = null;
  let artworkPath: string | null = null;
  if (raw.artworkData) {
    const bytes = Buffer.from(raw.artworkData, "base64");
    artworkHash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
    if (opts.artworkDir) {
      const ext = MIME_EXT[raw.artworkMimeType ?? ""] ?? "bin";
      mkdirSync(opts.artworkDir, { recursive: true });
      artworkPath = join(opts.artworkDir, `${artworkHash}.${ext}`);
      writeFileSync(artworkPath, bytes);
    }
  }

  return {
    id: trackIdentity(title, artist, album),
    sessionId: raw.contentItemIdentifier ?? null,
    title,
    artist,
    album,
    duration: typeof raw.duration === "number" ? raw.duration : null,
    position: raw.elapsedTime ?? 0,
    playing: derivePlaying(raw),
    playbackRate: raw.playbackRate ?? 0,
    source,
    sourceName: sourceNameOf(source),
    artworkHash,
    artworkPath,
    liked: toBool(raw.isLiked),
    shuffle: toBool(raw.shuffleMode),
    repeat: toBool(raw.repeatMode),
    sampledAt: raw.timestamp ?? new Date().toISOString(),
  };
}

/**
 * Position advances in real time while playing, but snapshots are only taken on
 * change. Extrapolate so Luna can line lyrics up without re-polling.
 */
export function positionAt(track: NowPlaying, now = new Date()): number {
  if (!track.playing) return track.position;
  const elapsed = (now.getTime() - new Date(track.sampledAt).getTime()) / 1000;
  const pos = track.position + elapsed * (track.playbackRate || 1);
  return track.duration === null ? pos : Math.min(pos, track.duration);
}

/** Two snapshots describe the same song? */
export function isSameTrack(a: NowPlaying | null, b: NowPlaying | null): boolean {
  if (!a || !b) return false;
  return a.id === b.id && a.source === b.source;
}
