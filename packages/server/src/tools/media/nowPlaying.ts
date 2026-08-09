import { readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import {
  Library,
  doctor,
  fetchLyrics,
  libraryExists,
  watch,
  type Lyrics,
  type MusicEvent,
  type NowPlaying,
  type TrackAffinity,
} from '@luna/music-cli';
import { musicEnrichEnabled } from './enrichment';

// Music observation (Initiative 32, v0.45.0) — the resident now-playing provider, the music
// counterpart of the weather snapshot (tools/web/weather/snapshot.ts): one long-lived
// subscription keeps the current track in memory so every reactive read is synchronous —
// zero network, zero subprocess. The stream is push-based (MediaRemote), so idle cost is
// nothing and a track change lands in ~0ms.
//
// Dormancy is the default: the whole layer wakes only when LUNA_MUSIC=1 AND the platform is
// darwin AND doctor() finds the media-control binary. Any other state = one log line, no
// subscription, and the server boots exactly as before — the provider must never throw, never
// block boot, never crash-loop.

export type MusicState = {
  track: NowPlaying | null;
  playing: boolean;
  // When the CURRENT track identity last changed (a 'track' event). v0.45.2's fresh-track
  // moment consumes this; v0.45.0 only records it.
  changedAtMs: number;
};

// Restart discipline for the stream child: bounded exponential backoff, then give up into
// dormancy with one warn — a dead media-control must never become a spawn storm.
export const MAX_STREAM_RESTARTS = 5;
export function restartDelayMs(attempt: number): number {
  return Math.min(60_000, 1000 * 2 ** attempt);
}

// v0.45.4: where the CLI drops artwork files (hash-named). The desktop supervisor points this at
// userData; standalone falls back to a tmp dir. Read by the /api/music/artwork endpoint.
export function artworkDir(): string {
  return Bun.env['LUNA_MUSIC_ARTWORK_DIR'] ?? join(tmpdir(), 'luna-music-artwork');
}

// Keep only the current track's file — replays overwrite by hash, and a listening day must not
// leave a trail of covers on disk (the plan's no-accumulation rule).
function sweepArtwork(dir: string, keepPath: string | null): void {
  try {
    const keep = keepPath === null ? null : basename(keepPath);
    for (const f of readdirSync(dir)) {
      if (f !== keep) rmSync(join(dir, f), { force: true });
    }
  } catch {
    /* dir may not exist yet — nothing to sweep */
  }
}

type Deps = {
  platform?: string;
  env?: Record<string, string | undefined>;
  doctorFn?: () => Promise<{ binaryFound: boolean; problems: string[] }>;
  watchFn?: (opts: { signal: AbortSignal }) => AsyncIterable<MusicEvent>;
  sleepFn?: (ms: number) => Promise<void>;
  libraryFactory?: () => Library | null;
  log?: (msg: string) => void;
  warn?: (msg: string) => void;
};

let state: MusicState = { track: null, playing: false, changedAtMs: 0 };
let active = false;
let controller: AbortController | null = null;

// v0.45.8 (Initiative 34) — the companionship payload, held per current track: the local
// library's affinity (how well he knows this song) and the FULL lyrics, fetched once per track
// change (D4). `delivered` is the read-once-burn mark (D5): the first turn after a track change
// carries the whole lyric exactly once; after that the words live in conversation history, not
// in the prompt. The library is ONE read-only connection for the provider's lifetime (D3 —
// the client owns writes; the CLI constructor enforces readonly and we never bypass it).
export type MusicEnrichment = {
  trackId: string;
  neteaseId: string | null;
  affinity: TrackAffinity | null;
  lyrics: Lyrics | null;
  delivered: boolean;
};

let library: Library | null = null;
let enrichment: MusicEnrichment | null = null;

export function getMusicEnrichment(): MusicEnrichment | null {
  return active ? enrichment : null;
}

// The burn: called by the ambient builder the moment a lyrics block is composed into a turn.
export function markLyricsDelivered(trackId: string): void {
  if (enrichment?.trackId === trackId) enrichment = { ...enrichment, delivered: true };
}

// v0.45.17: …and the un-burn. A turn that dies before its first token rolls its history back,
// which erases the lyrics block — but the mark stayed set, so the words were in neither the
// prompt nor the past and "she read this song" was simply false. The rollback is symmetric now.
export function unmarkLyricsDelivered(trackId: string): void {
  if (enrichment?.trackId === trackId) enrichment = { ...enrichment, delivered: false };
}

// Exposed for tests (and a future settings probe): whether the affinity face found the library.
export function musicLibrary(): Library | null {
  return library;
}

type EnrichDeps = {
  resolveId?: (title: string, artist: string, durationMs: number | null) => string | null;
  affinityFn?: (id: string) => TrackAffinity | null;
  fetchLyricsFn?: (id: string) => Promise<Lyrics | null>;
};
let enrichDeps: EnrichDeps = {};
export function setEnrichDepsForTests(d: EnrichDeps | null): void {
  enrichDeps = d ?? {};
}

// One enrich per track change (D4): local id resolution + affinity are synchronous reads on the
// read-only library; the lyric fetch is ONE network call, gated by LUNA_MUSIC_ENRICH, and a late
// result for a superseded track is dropped (identity check on both async edges).
function enrichCurrent(track: NowPlaying): void {
  const resolve =
    enrichDeps.resolveId ??
    ((t: string, a: string, d: number | null) => (library ? library.resolveId(t, a, d) : null));
  const aff = enrichDeps.affinityFn ?? ((id: string) => (library ? library.affinity(id) : null));
  // v0.45.15 (A4): duration joins the confidence gate — title+artist alone let a cover borrow
  // the library track's play history.
  const neteaseId = resolve(
    track.title,
    track.artist,
    track.duration === null ? null : track.duration * 1000,
  );
  enrichment = {
    trackId: track.id,
    neteaseId,
    affinity: neteaseId ? aff(neteaseId) : null,
    lyrics: null,
    delivered: false,
  };
  if (neteaseId !== null && musicEnrichEnabled()) {
    const fetchFn = enrichDeps.fetchLyricsFn ?? fetchLyrics;
    void fetchFn(neteaseId)
      .then((ly) => {
        if (enrichment?.trackId === track.id) enrichment = { ...enrichment, lyrics: ly };
      })
      .catch(() => {});
  }
}
// v0.45.3: fired on every 'track' event (a NEW song settled). Enrichment subscribes here when
// LUNA_MUSIC_ENRICH=1; a hook failure must never touch the stream loop.
let onTrackChange: ((t: NowPlaying) => void) | null = null;

export function setOnTrackChange(fn: ((t: NowPlaying) => void) | null): void {
  onTrackChange = fn;
}

export function musicProviderActive(): boolean {
  return active;
}

// The synchronous read every consumer shares (tool, ambient context, player card). Pure data;
// null means the provider is dormant — callers distinguish "dormant" from "idle" (active with
// track: null).
export function getNowPlaying(): MusicState | null {
  return active ? state : null;
}

export function applyMusicEvent(ev: MusicEvent, nowMs: number): void {
  if (ev.event === 'track') {
    state = { track: ev.track, playing: ev.track.playing, changedAtMs: nowMs };
    if (ev.track.artworkPath !== null) sweepArtwork(artworkDir(), ev.track.artworkPath);
    try {
      enrichCurrent(ev.track);
    } catch {
      /* enrich must never break the stream loop */
    }
    try {
      onTrackChange?.(ev.track);
    } catch {
      /* a subscriber must never break the stream loop */
    }
  } else if (ev.event === 'state') {
    state = { ...state, track: ev.track, playing: ev.playing };
  } else {
    state = { track: null, playing: false, changedAtMs: state.changedAtMs };
    enrichment = null;
  }
}

// Resolves once the wake-or-sleep decision is made (the subscription loop keeps running in the
// background). Boot calls this fire-and-forget; tests await it.
export async function startNowPlaying(deps: Deps = {}): Promise<void> {
  const env = deps.env ?? Bun.env;
  const platform = deps.platform ?? process.platform;
  const log = deps.log ?? ((m) => console.log(m));
  const warn = deps.warn ?? ((m) => console.warn(m));
  if (active) return; // idempotent — a second start must not double-subscribe

  if (env['LUNA_MUSIC'] !== '1') return; // dormant by default — not even a log
  if (platform !== 'darwin') {
    log('[music] LUNA_MUSIC=1 but platform is not darwin — music layer dormant');
    return;
  }
  try {
    const d = await (deps.doctorFn ?? doctor)();
    if (!d.binaryFound) {
      log(`[music] dormant: ${d.problems[0] ?? 'media-control not found'}`);
      return;
    }
  } catch (e) {
    log(`[music] doctor failed — music layer dormant: ${e instanceof Error ? e.message : e}`);
    return;
  }

  active = true;
  controller = new AbortController();
  const signal = controller.signal;
  // v0.45.8: the affinity face — one read-only connection for the provider's lifetime. Absent
  // library (client never ran on this machine) = the face sleeps with one log; titles still flow.
  if (deps.libraryFactory) {
    library = deps.libraryFactory();
  } else if (libraryExists()) {
    try {
      library = new Library();
    } catch (e) {
      log(`[music] library open failed — affinity face dormant: ${e instanceof Error ? e.message : e}`);
      library = null;
    }
  } else {
    log('[music] no local NetEase library — affinity face dormant, titles still flow');
    library = null;
  }
  const watchFn = deps.watchFn ?? ((opts: { signal: AbortSignal }) => watch({ ...opts, artworkDir: artworkDir() }));
  const sleep = deps.sleepFn ?? Bun.sleep;
  log('[music] now-playing observation started');

  void (async () => {
    let failures = 0;
    while (!signal.aborted && failures < MAX_STREAM_RESTARTS) {
      let sawEvent = false;
      try {
        for await (const ev of watchFn({ signal })) {
          sawEvent = true;
          failures = 0; // a live stream earns back its restart budget
          applyMusicEvent(ev, Date.now());
        }
      } catch {
        /* stream error — counted below like any other death */
      }
      if (signal.aborted) break;
      // The generator returning at all means the child died (it only ends on abort). An
      // instant death that never produced an event still consumes a restart.
      failures += 1;
      if (!sawEvent && failures < MAX_STREAM_RESTARTS) {
        /* fallthrough to backoff */
      }
      if (failures >= MAX_STREAM_RESTARTS) break;
      await sleep(restartDelayMs(failures));
    }
    if (!signal.aborted) {
      warn(`[music] stream died ${MAX_STREAM_RESTARTS} times — music layer going dormant`);
    }
    active = false;
    state = { track: null, playing: false, changedAtMs: 0 };
  })();
}

// Clean kill for shutdown (aborting the watch kills the media-control child) — and the reset
// tests rely on.
export function stopNowPlaying(): void {
  controller?.abort();
  controller = null;
  active = false;
  state = { track: null, playing: false, changedAtMs: 0 };
  enrichment = null;
  library?.close();
  library = null;
}
