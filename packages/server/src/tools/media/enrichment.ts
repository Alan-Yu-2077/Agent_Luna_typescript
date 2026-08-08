import type { NowPlaying } from '@luna/music-cli';
import { getMemoryDb } from '../../memory/sessionStore';

// Initiative 32 (v0.45.3) — lyric + hot-comment enrichment, the deliberately isolated second
// layer. research.md (this directory) is the build/cut memo: all three endpoints are anonymous
// plain-API (no weapi, no credentials — D4), and the one weak link is SEARCH, whose index is
// 100% knockoff-flooded for delisted catalogs. The whole design bends around that: a strict
// three-way confidence gate (exact title + exact artist + duration ±3s), and no match means NO
// enrich — someone else's lyrics on his song is far worse than no lyrics (宁缺勿错).
//
// Default OFF (LUNA_MUSIC_ENRICH=1 opts in). Every failure is silent; the turn path only ever
// reads SQLite synchronously; the network fires once per track identity, ever (negative results
// cached too). If the unmaintained upstream vanishes, cached songs keep their words and new
// songs degrade to title-only — v0.45.0/1/2 never notice.

export function musicEnrichEnabled(): boolean {
  return Bun.env['LUNA_MUSIC_ENRICH'] === '1';
}

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/126.0 Safari/537.36';

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

function timeoutMs(): number {
  return Number(Bun.env['LUNA_MUSIC_ENRICH_TIMEOUT_MS'] ?? 8000);
}

async function getJson(url: string, fetchFn: FetchLike): Promise<unknown> {
  const res = await fetchFn(url, {
    headers: { 'user-agent': UA },
    signal: AbortSignal.timeout(timeoutMs()),
  });
  if (!res.ok) throw new Error(`http ${res.status}`);
  return res.json();
}

// ---- the confidence gate (pure) ----

// Lower, trim, collapse whitespace. Deliberately NOTHING more: "周杰伦-" must stay ≠ "周杰伦"
// (the knockoff suffix is the tell), and 伤感版/remix suffixes must keep a title unequal.
export function normName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export type SearchCandidate = {
  id: number;
  name: string;
  artists: string[];
  durationMs: number | null;
};

export const DURATION_TOLERANCE_MS = 3000;

export function pickMatch(
  track: { title: string; artist: string; duration: number | null },
  candidates: SearchCandidate[],
): SearchCandidate | null {
  const title = normName(track.title);
  const artist = normName(track.artist);
  for (const c of candidates) {
    if (normName(c.name) !== title) continue;
    const joined = normName(c.artists.join('/'));
    const single = c.artists.length === 1 && normName(c.artists[0] ?? '') === artist;
    if (joined !== artist && !single) continue;
    if (
      track.duration !== null &&
      c.durationMs !== null &&
      Math.abs(c.durationMs - track.duration * 1000) > DURATION_TOLERANCE_MS
    ) {
      continue;
    }
    return c;
  }
  return null;
}

// ---- LRC (pure) ----

export type LrcLine = { tMs: number; text: string };

export function parseLrc(lrc: string): LrcLine[] {
  const out: LrcLine[] = [];
  for (const raw of lrc.split('\n')) {
    const m = raw.match(/^\[(\d+):(\d+)(?:\.(\d+))?\](.*)$/);
    if (!m) continue;
    const frac = m[3] ?? '0';
    const tMs =
      Number(m[1]) * 60_000 + Number(m[2]) * 1000 + Math.round(Number(`0.${frac}`) * 1000);
    const text = (m[4] ?? '').trim();
    if (!text) continue;
    if (/^(作词|作曲|编曲|制作人|吉他|和声|混音|录音|母带|监制|出品|发行)\s*[:：]/.test(text)) continue;
    out.push({ tMs, text });
  }
  return out.sort((a, b) => a.tMs - b.tMs);
}

// The current line and the one before it — a passing fragment, never the sheet. An untimestamped
// lyric parses to zero lines and degrades to nothing.
export function lyricLinesAt(lines: LrcLine[], positionS: number, max = 2): string[] {
  const posMs = positionS * 1000;
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.tMs <= posMs) idx = i;
    else break;
  }
  if (idx < 0) return [];
  return lines.slice(Math.max(0, idx - (max - 1)), idx + 1).map((l) => l.text);
}

// ---- network (injected fetch; every caller catches) ----

type RawSearch = {
  result?: { songs?: Array<{ id: number; name: string; duration?: number; artists?: Array<{ name: string }> }> };
};
type RawLyric = { lrc?: { lyric?: string } };
type RawComments = { hotComments?: Array<{ content: string; likedCount?: number }> };

export async function searchSong(
  track: { title: string; artist: string; duration: number | null },
  fetchFn: FetchLike,
): Promise<SearchCandidate | null> {
  const q = encodeURIComponent(`${track.title} ${track.artist}`);
  const data = (await getJson(
    `https://music.163.com/api/search/get?s=${q}&type=1&limit=10`,
    fetchFn,
  )) as RawSearch;
  const candidates: SearchCandidate[] = (data.result?.songs ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    artists: (s.artists ?? []).map((a) => a.name),
    durationMs: typeof s.duration === 'number' ? s.duration : null,
  }));
  return pickMatch(track, candidates);
}

async function fetchLyric(songId: number, fetchFn: FetchLike): Promise<string> {
  const data = (await getJson(
    `https://music.163.com/api/song/lyric?id=${songId}&lv=1&kv=1&tv=-1`,
    fetchFn,
  )) as RawLyric;
  return data.lrc?.lyric ?? '';
}

export type HotComment = { content: string; liked: number };

async function fetchComments(songId: number, fetchFn: FetchLike): Promise<HotComment[]> {
  const data = (await getJson(
    `https://music.163.com/api/v1/resource/comments/R_SO_4_${songId}?limit=5`,
    fetchFn,
  )) as RawComments;
  return (data.hotComments ?? [])
    .slice(0, 5)
    .map((c) => ({ content: c.content, liked: c.likedCount ?? 0 }));
}

// ---- the cache (SQLite, synchronous reads) ----

type Row = {
  identity: string;
  song_id: number | null;
  lyric_lrc: string;
  comments_json: string;
};

function readRow(identity: string): Row | null {
  const db = getMemoryDb();
  if (!db) return null;
  return db
    .prepare('SELECT identity, song_id, lyric_lrc, comments_json FROM music_enrichment WHERE identity = ?')
    .get(identity) as Row | null;
}

// ---- the one write path: change-driven, once per identity, ever ----

export async function enrichTrack(
  track: NowPlaying,
  fetchFn: FetchLike = fetch as FetchLike,
): Promise<void> {
  if (!musicEnrichEnabled()) return;
  const db = getMemoryDb();
  if (!db) return;
  if (readRow(track.id) !== null) return; // hit — positive or negative, zero network

  let songId: number | null = null;
  let matched: SearchCandidate | null = null;
  try {
    matched = await searchSong(track, fetchFn);
    songId = matched?.id ?? null;
  } catch {
    // Search failing is NOT a cachable "no match" — leave no row so a later change retries.
    return;
  }

  let lyric = '';
  let comments: HotComment[] = [];
  if (songId !== null) {
    // Each leg independent and silent — a missing lyric never costs the comments, or vice versa.
    [lyric, comments] = await Promise.all([
      fetchLyric(songId, fetchFn).catch(() => ''),
      fetchComments(songId, fetchFn).catch(() => [] as HotComment[]),
    ]);
  }
  db.prepare(
    'INSERT OR REPLACE INTO music_enrichment (identity, song_id, matched_title, matched_artist, lyric_lrc, comments_json, fetched_ms) VALUES (?,?,?,?,?,?,?)',
  ).run(
    track.id,
    songId,
    matched?.name ?? '',
    matched?.artists.join('/') ?? '',
    lyric,
    JSON.stringify(comments),
    Date.now(),
  );
}

// ---- the two consumer reads (synchronous, turn-path safe) ----

// v0.45.8 (D5): the per-turn ≤2-line injection is RETIRED — sliced lines were fake precision
// over a laggy turn loop. The search-fallback path now serves the WHOLE cached lyric once, into
// the same read-once-burn delivery the local-id path uses. Gate, negative cache and hot
// comments are untouched (hard-part-3 red line).
export function fullLyricsFor(identity: string): string[] | null {
  if (!musicEnrichEnabled()) return null;
  const row = readRow(identity);
  if (!row || row.song_id === null || !row.lyric_lrc) return null;
  const lines = parseLrc(row.lyric_lrc).map((l) => l.text);
  return lines.length > 0 ? lines : null;
}

export const COMMENT_MAX_CHARS = 80;

// The top hot comment, truncated — seed material for the track-change moment.
export function hotCommentFor(identity: string): string | null {
  if (!musicEnrichEnabled()) return null;
  const row = readRow(identity);
  if (!row || row.song_id === null) return null;
  try {
    const comments = JSON.parse(row.comments_json) as HotComment[];
    const first = comments[0]?.content.trim();
    if (!first) return null;
    return first.length > COMMENT_MAX_CHARS ? `${first.slice(0, COMMENT_MAX_CHARS)}…` : first;
  } catch {
    return null;
  }
}
