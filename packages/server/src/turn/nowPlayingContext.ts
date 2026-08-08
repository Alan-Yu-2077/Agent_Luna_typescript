// Initiative 32 (v0.45.1) — passive ambient music. The resident provider (v0.45.0) already
// holds the current track in memory, so this is weatherContext all over again: a pure TS
// formatter reads the snapshot SYNCHRONOUSLY and rides the UNCACHED user tail. She knows what
// he's listening to without asking — and must not burn a tool call per turn to learn it (the
// stream pushes; the answer is already here). No track → no block, zero prompt residue.

import { positionAt, type NowPlaying } from '@luna/music-cli';
import { getNowPlaying } from '../tools/media/nowPlaying';

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

// The per-turn read: null when dormant, idle, or between tracks — the prompt shows no trace.
export function musicBlockFor(now = new Date()): string | null {
  const s = getNowPlaying();
  if (s === null || s.track === null) return null;
  return buildMusicBlock(musicFactsOf(s.track, s.playing, now));
}
