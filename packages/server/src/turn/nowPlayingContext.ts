// Initiative 32 (v0.45.1) — passive ambient music. The resident provider (v0.45.0) already
// holds the current track in memory, so this is weatherContext all over again: a pure TS
// formatter reads the snapshot SYNCHRONOUSLY and rides the UNCACHED user tail. She knows what
// he's listening to without asking — and must not burn a tool call per turn to learn it (the
// stream pushes; the answer is already here). No track → no block, zero prompt residue.

import { positionAt, type NowPlaying, type TrackAffinity } from '@luna/music-cli';
import { getMusicEnrichment, getNowPlaying, markLyricsDelivered } from '../tools/media/nowPlaying';
import { fullLyricsFor } from '../tools/media/enrichment';

// Default ON riding LUNA_MUSIC (the provider's own gate); LUNA_MUSIC_AMBIENT=0 is the off
// switch — the tools stay mounted, only the ambient block disappears.
export function musicAmbientEnabled(): boolean {
  return Bun.env['LUNA_MUSIC_AMBIENT'] !== '0' && getNowPlaying() !== null;
}

// The builder's input type is the artwork firewall: scalars only, so tens-of-KB base64 artwork
// cannot reach the prompt through a type-level door — not runtime discipline, absence of a field.
export type MusicFacts = {
  title: string;
  artist: string;
  album: string;
  playing: boolean;
  positionS: number;
  durationS: number | null;
  sourceName: string;
};

// Coarse progress wording. Three phases, not seconds: second-level precision means nothing in
// conversation and would churn the prompt text every turn (same track, same phase → same bytes).
export function progressPhase(positionS: number, durationS: number | null): 'start' | 'middle' | 'end' | null {
  if (durationS === null || durationS <= 0) return null;
  if (positionS < 30 || positionS / durationS < 0.15) return 'start';
  if (durationS - positionS < 30 || positionS / durationS > 0.85) return 'end';
  return 'middle';
}

// The track phrase v0.45.2's proactive seed reuses — keep it exported and stable.
export function trackPhrase(f: Pick<MusicFacts, 'title' | 'artist'>): string {
  return `"${f.title}"${f.artist ? ` by ${f.artist}` : ''}`;
}

export function musicFactsOf(track: NowPlaying, playing: boolean, now = new Date()): MusicFacts {
  return {
    title: track.title,
    artist: track.artist,
    album: track.album,
    playing,
    positionS: Math.round(positionAt(track, now)),
    durationS: track.duration === null ? null : Math.round(track.duration),
    sourceName: track.sourceName,
  };
}

const PLAYING_PHASE: Record<'start' | 'middle' | 'end', string> = {
  start: 'it just started',
  middle: 'around the middle',
  end: 'almost over',
};
const PAUSED_PHASE: Record<'start' | 'middle' | 'end', string> = {
  start: 'stopped near the start',
  middle: 'stopped around the middle',
  end: 'stopped near the end',
};

// Pure, synchronous, format-only — a finished, labeled fact (the buildWeatherBlock philosophy).
export function buildMusicBlock(f: MusicFacts): string {
  const phase = progressPhase(f.positionS, f.durationS);
  const album = f.album && f.album !== f.title ? ` (album "${f.album}")` : '';
  if (f.playing) {
    const where = phase ? ` — ${PLAYING_PHASE[phase]}` : '';
    return `Music the user is playing right now: ${trackPhrase(f)}${album}${where}.`;
  }
  const stopped = phase ? PAUSED_PHASE[phase] : 'stopped partway';
  return `Music, currently paused: ${trackPhrase(f)}${album} — ${stopped}.`;
}

// v0.45.8 (D5): the resident block NEVER carries lyric lines — sliced "current line" over a
// turn loop with tens of seconds of latency was fake precision, retired by the owner. What it
// gains instead is the affinity sentence: how well he knows this song, worded as an opening,
// not a report. Null affinity (off-library track, no local client library) = silent omission.
export function affinityPhrase(a: TrackAffinity): string | null {
  if (a.sessions === 0) return null;
  const hours = a.listenedSeconds / 3600;
  const time =
    hours >= 1 ? `about ${hours >= 10 ? Math.round(hours) : Math.round(hours * 10) / 10} hours` : `${Math.max(1, Math.round(a.listenedSeconds / 60))} minutes`;
  const rank = a.rank !== null && a.rank <= 10 ? ` — his #${a.rank} most-played overall` : '';
  return `He knows this one well: ${a.sessions} plays, ${time} of listening${rank}.`;
}

// The per-turn read: null when dormant, idle, or between tracks — the prompt shows no trace.
export function musicBlockFor(now = new Date()): string | null {
  const s = getNowPlaying();
  if (s === null || s.track === null) return null;
  let block = buildMusicBlock(musicFactsOf(s.track, s.playing, now));
  const enrich = getMusicEnrichment();
  if (enrich && enrich.trackId === s.track.id && enrich.affinity) {
    const phrase = affinityPhrase(enrich.affinity);
    if (phrase) block += ` ${phrase}`;
  }
  return block;
}

// v0.45.8 (D5) — the read-once-burn lyrics delivery: the FIRST turn after a track change carries
// the whole lyric, once. After that the words live in conversation history; she read the song,
// and which line to quote (if any) is her judgment — no pretended second-level sync. Local-id
// lyrics (provider enrich) are the main path; the shipped search-fallback cache serves
// off-library tracks through this SAME delivery. A turn-less track costs nothing.
export const LYRICS_MAX_LINES = 60;
export const LYRICS_MAX_CHARS = 2000;

export function formatLyricsBlock(title: string, artist: string, lines: string[]): string {
  let out = lines;
  let truncated = false;
  if (out.length > LYRICS_MAX_LINES) {
    out = out.slice(0, LYRICS_MAX_LINES);
    truncated = true;
  }
  let body = out.join('\n');
  if (body.length > LYRICS_MAX_CHARS) {
    body = body.slice(0, LYRICS_MAX_CHARS);
    truncated = true;
  }
  const head = `Full lyrics of ${trackPhrase({ title, artist })} — provided once for this play; refer back from memory as you like:`;
  const tail = truncated ? '\n…(truncated)' : '';
  return `${head}\n${body}${tail}`;
}

export function lyricsBurstFor(): string | null {
  const s = getNowPlaying();
  if (s === null || s.track === null) return null;
  const enrich = getMusicEnrichment();
  if (!enrich || enrich.trackId !== s.track.id || enrich.delivered) return null;
  let lines: string[] | null = null;
  if (enrich.lyrics && enrich.lyrics.lines.length > 0) {
    lines = enrich.lyrics.lines.map((l) => (l.translation ? `${l.text} / ${l.translation}` : l.text));
  } else {
    lines = fullLyricsFor(s.track.id);
  }
  if (lines === null) return null;
  markLyricsDelivered(s.track.id);
  return formatLyricsBlock(s.track.title, s.track.artist, lines);
}
