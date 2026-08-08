// Vendored from ~/Desktop/luna-music-cli (upstream re-vendor 2026-08-08: 37 tests green, +enrich/library/lyrics; prior live-verify 2026-08-07).
/**
 * The ONLY module that knows the NetEase lyrics endpoint and LRC format.
 *
 * Lyrics are the fuel for listening *along* — without the words Luna only knows
 * a title. Crucially, this endpoint serves lyrics for VIP tracks WITHOUT
 * authentication (verified against a fee=1 track): lyrics are not DRM'd content,
 * so this whole layer costs zero credentials and carries none of route 2's
 * account risk.
 *
 * The endpoint is unofficial and may change; it is isolated here and every path
 * degrades to "no lyrics" rather than throwing, so the rest of perception keeps
 * working when the network is down or the format shifts.
 */

import { Lyrics, LyricLine, LyricPosition } from "./types";

const ENDPOINT = "https://music.163.com/api/song/lyric";

/** `[mm:ss.xx]` or `[mm:ss.xxx]` line tags. A line may carry several. */
const TAG = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

interface RawLyricResponse {
  lrc?: { lyric?: string };
  tlyric?: { lyric?: string };
}

/**
 * Parse one LRC body into time-tagged lines, sorted by time. Lines with no
 * timestamp (credits headers, plain-text lyrics) are dropped from the synced
 * view; `synced` reflects whether any timestamps were found at all.
 */
export function parseLrc(lrc: string): { lines: Omit<LyricLine, "translation">[]; synced: boolean } {
  const lines: Omit<LyricLine, "translation">[] = [];
  let sawTag = false;

  for (const raw of lrc.split("\n")) {
    const text = raw.replace(TAG, "").trim();
    TAG.lastIndex = 0;
    let m: RegExpExecArray | null;
    let matched = false;
    while ((m = TAG.exec(raw)) !== null) {
      matched = true;
      sawTag = true;
      const min = Number(m[1]);
      const sec = Number(m[2]);
      const frac = m[3] ? Number(m[3].padEnd(3, "0")) : 0;
      const timeMs = min * 60_000 + sec * 1000 + frac;
      if (text) lines.push({ timeMs, text });
    }
    void matched;
  }

  lines.sort((a, b) => a.timeMs - b.timeMs);
  return { lines, synced: sawTag };
}

/** Merge a translation LRC onto the main lines by exact timestamp. */
function mergeTranslation(
  base: Omit<LyricLine, "translation">[],
  translation: Omit<LyricLine, "translation">[],
): LyricLine[] {
  const byTime = new Map<number, string>();
  for (const t of translation) byTime.set(t.timeMs, t.text);
  return base.map((l) => ({ ...l, translation: byTime.get(l.timeMs) ?? null }));
}

/**
 * Fetch and parse a track's lyrics. Returns null on any failure (network,
 * non-200, empty body, malformed JSON) — the caller treats that as "no lyrics".
 */
export async function fetchLyrics(neteaseId: string, signal?: AbortSignal): Promise<Lyrics | null> {
  let res: Response;
  try {
    const url = `${ENDPOINT}?id=${encodeURIComponent(neteaseId)}&lv=1&tv=1`;
    res = await fetch(url, { signal });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  let data: RawLyricResponse;
  try {
    data = (await res.json()) as RawLyricResponse;
  } catch {
    return null;
  }

  const lrc = data.lrc?.lyric ?? "";
  if (!lrc.trim()) return null;

  const parsed = parseLrc(lrc);
  const tParsed = data.tlyric?.lyric ? parseLrc(data.tlyric.lyric) : { lines: [], synced: false };
  const lines = mergeTranslation(parsed.lines, tParsed.lines);

  return {
    neteaseId,
    lines,
    hasTranslation: tParsed.lines.length > 0,
    synced: parsed.synced,
  };
}

/**
 * Where the playhead sits in the lyrics at `positionMs`. Binary-search for the
 * last line whose timestamp is ≤ position — that's the line being sung now.
 */
export function lineAt(lyrics: Lyrics, positionMs: number): LyricPosition {
  const { lines } = lyrics;
  if (lines.length === 0) return { current: null, next: null, index: -1 };

  let lo = 0;
  let hi = lines.length - 1;
  let idx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid]!.timeMs <= positionMs) {
      idx = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return {
    current: idx >= 0 ? lines[idx]! : null,
    next: idx + 1 < lines.length ? lines[idx + 1]! : null,
    index: idx,
  };
}
