// Vendored from ~/Desktop/luna-music-cli (upstream re-vendor 2026-08-08: 37 tests green, +enrich/library/lyrics; prior live-verify 2026-08-07).
/**
 * Perception synthesis — the one call Luna makes to see the whole picture:
 * what's playing (MediaRemote), your history with it (local cache), and the
 * words on screen right now (lyrics API), fused into one payload.
 *
 * Each source is independent and optional: no library → no affinity; no network
 * → no lyric; no match → both null. The current track always survives, so this
 * never fails harder than plain `now`.
 */

import { positionAt } from "./adapter";
import { Library } from "./library";
import { fetchLyrics, lineAt } from "./lyrics";
import { NowPlaying, EnrichedNowPlaying, Lyrics } from "./types";

export interface EnrichOptions {
  /** Reuse an open Library across calls instead of opening one per enrich. */
  library?: Library;
  /** Reuse already-fetched lyrics (e.g. cached for the current track). */
  lyrics?: Lyrics | null;
  /** Skip the network fetch entirely. */
  noLyrics?: boolean;
  signal?: AbortSignal;
}

/**
 * Enrich a now-playing snapshot with affinity and the current lyric line.
 *
 * The lyric line is computed from the *live* playhead (`positionAt`), not the
 * sample-time position, so it tracks in real time between snapshots.
 */
export async function enrich(
  track: NowPlaying,
  opts: EnrichOptions = {},
): Promise<EnrichedNowPlaying> {
  const lib = opts.library ?? new Library();
  const ownLib = !opts.library;

  try {
    const neteaseId = lib.resolveId(
      track.title,
      track.artist,
      track.duration === null ? null : track.duration * 1000,
    );
    const affinity = neteaseId ? lib.affinity(neteaseId) : null;

    let lyric: EnrichedNowPlaying["lyric"] = null;
    if (neteaseId && !opts.noLyrics) {
      const lyrics =
        opts.lyrics !== undefined
          ? opts.lyrics
          : await fetchLyrics(neteaseId, opts.signal);
      if (lyrics) lyric = lineAt(lyrics, positionAt(track) * 1000);
    }

    return { ...track, position: positionAt(track), neteaseId, affinity, lyric };
  } finally {
    if (ownLib) lib.close();
  }
}
