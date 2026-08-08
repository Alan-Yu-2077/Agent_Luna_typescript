import { z } from 'zod';
import { defineTool } from '../defineTool';
import { getMusicEnrichment, getNowPlaying, musicLibrary } from '../media/nowPlaying';
import { fullLyricsFor } from '../media/enrichment';
import {
  LYRICS_MAX_CHARS,
  LYRICS_MAX_LINES,
} from '../../turn/nowPlayingContext';

// Music library tools (Initiative 34, v0.45.9) — her permission to browse his record shelf,
// read-only (D3), zero network, zero credentials. ONE tool with an op enum ("look through the
// library" is one capability), plus music_lyrics as the separate re-read of the current song's
// words (D5's safety net: the read-once-burn block gets pruned with history; this rereads the
// CACHE, never the network — D4). Both are genuinely read-only ⇒ proactiveRisk: 'safe' — the
// deliberate counterpart to music_control's fail-closed surface.

const LIBRARY_UNAVAILABLE =
  'music library is not available (LUNA_MUSIC unset, provider dormant, or the NetEase client has never run here)';

const Item = z.object({
  kind: z.enum(['track', 'playlist']),
  title: z.string(),
  artist: z.string().nullable(),
  album: z.string().nullable(),
  sessions: z.number().nullable(),
  listened_min: z.number().nullable(),
  played_at_ms: z.number().nullable(),
  track_count: z.number().nullable(),
});
type Item = z.infer<typeof Item>;

const LibraryInput = z.object({
  op: z.enum(['search', 'top', 'history', 'playlists']),
  // search only — what to look for (title / artist substring)
  query: z.string().optional(),
  limit: z.number().int().min(1).max(30).optional(),
});

const LibraryOutput = z.object({
  op: z.string(),
  count: z.number(),
  items: z.array(Item),
});

function trackItem(t: {
  title: string;
  artist: string;
  album: string;
}, extra: Partial<Item> = {}): Item {
  return {
    kind: 'track',
    title: t.title,
    artist: t.artist || null,
    album: t.album || null,
    sessions: null,
    listened_min: null,
    played_at_ms: null,
    track_count: null,
    ...extra,
  };
}

function fmtMin(min: number | null): string {
  if (min === null) return '';
  return min >= 60 ? ` ${Math.round(min / 60)}h` : ` ${min}min`;
}

function summarizeItems(op: string, items: Item[]): string {
  if (items.length === 0) return `${op}: nothing found`;
  const head = items
    .slice(0, 5)
    .map((i, n) =>
      i.kind === 'playlist'
        ? `${i.title}${i.track_count !== null ? ` (${i.track_count})` : ''}`
        : `${n + 1}. ${i.title}${i.artist ? `/${i.artist}` : ''}${fmtMin(i.listened_min)}`,
    )
    .join(' · ');
  const more = items.length > 5 ? ` (+${items.length - 5} more)` : '';
  return `${op}: ${head}${more}`;
}

export const musicLibraryTool = defineTool({
  name: 'music_library',
  description:
    'Browse his listening history in the local music library (read-only): op "search" finds songs ' +
    'by title/artist, "top" lists his most-listened, "history" his recently played, "playlists" his ' +
    'saved playlists. The CURRENT track is already in your ambient context — this tool is for the ' +
    'shelf and the past, not for what is playing now.',
  input: LibraryInput,
  output: LibraryOutput,
  concurrency: 'safe-parallel',
  proactiveRisk: 'safe',
  timeoutMs: 5000,
  summarize: (out) => summarizeItems(out.op, out.items),
  execute: async function* (input, _ctx) {
    const lib = musicLibrary();
    if (lib === null || !lib.available) {
      yield { kind: 'err', code: 'execution_exception', message: LIBRARY_UNAVAILABLE, recoverable: true };
      return;
    }
    if (input.op === 'search') {
      const q = input.query?.trim() ?? '';
      if (!q) {
        yield {
          kind: 'err',
          code: 'validation_failed',
          message: 'op "search" needs a query',
          recoverable: true,
        };
        return;
      }
      const items = lib.search(q, input.limit ?? 10).map((t) => trackItem(t));
      yield { kind: 'ok', data: { op: 'search', count: items.length, items } };
      return;
    }
    if (input.op === 'top') {
      const items = lib.top(input.limit ?? 10).map((t) =>
        trackItem(t, { sessions: t.sessions, listened_min: Math.round(t.listenedSeconds / 60) }),
      );
      yield { kind: 'ok', data: { op: 'top', count: items.length, items } };
      return;
    }
    if (input.op === 'history') {
      const items = lib.history(input.limit ?? 15).map((t) => trackItem(t, { played_at_ms: t.playedAt }));
      yield { kind: 'ok', data: { op: 'history', count: items.length, items } };
      return;
    }
    const items: Item[] = lib.playlists().map((p) => ({
      kind: 'playlist',
      title: p.name,
      artist: null,
      album: null,
      sessions: null,
      listened_min: null,
      played_at_ms: null,
      track_count: p.trackCount,
    }));
    yield { kind: 'ok', data: { op: 'playlists', count: items.length, items } };
  },
});

const LyricsOutput = z.object({
  title: z.string(),
  artist: z.string(),
  lines: z.array(z.string()),
  truncated: z.boolean(),
});

export const musicLyricsTool = defineTool({
  name: 'music_lyrics',
  description:
    'Re-read the full lyrics of the CURRENT track from the local cache (zero network). The lyrics ' +
    'were already handed to you once when the track started — use this only when that text has ' +
    'scrolled out of reach and you want to re-read it.',
  input: z.object({}),
  output: LyricsOutput,
  concurrency: 'safe-parallel',
  proactiveRisk: 'safe',
  timeoutMs: 5000,
  summarize: (out) =>
    `lyrics of "${out.title}" — ${out.lines.length} lines${out.truncated ? ' (truncated)' : ''}`,
  execute: async function* (_input, _ctx) {
    const s = getNowPlaying();
    if (s === null || s.track === null) {
      yield { kind: 'err', code: 'execution_exception', message: 'nothing is playing', recoverable: true };
      return;
    }
    const enrich = getMusicEnrichment();
    let lines: string[] | null = null;
    if (enrich && enrich.trackId === s.track.id && enrich.lyrics && enrich.lyrics.lines.length > 0) {
      lines = enrich.lyrics.lines.map((l) => (l.translation ? `${l.text} / ${l.translation}` : l.text));
    } else {
      lines = fullLyricsFor(s.track.id);
    }
    if (lines === null) {
      yield {
        kind: 'err',
        code: 'execution_exception',
        message: 'no lyrics cached for this track',
        recoverable: true,
      };
      return;
    }
    let truncated = false;
    if (lines.length > LYRICS_MAX_LINES) {
      lines = lines.slice(0, LYRICS_MAX_LINES);
      truncated = true;
    }
    let chars = 0;
    const bounded: string[] = [];
    for (const l of lines) {
      if (chars + l.length > LYRICS_MAX_CHARS) {
        truncated = true;
        break;
      }
      bounded.push(l);
      chars += l.length;
    }
    yield {
      kind: 'ok',
      data: { title: s.track.title, artist: s.track.artist, lines: bounded, truncated },
    };
  },
});
