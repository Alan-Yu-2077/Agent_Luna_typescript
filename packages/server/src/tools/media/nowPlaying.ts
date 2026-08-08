import { doctor, watch, type MusicEvent, type NowPlaying } from '@luna/music-cli';

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

type Deps = {
  platform?: string;
  env?: Record<string, string | undefined>;
  doctorFn?: () => Promise<{ binaryFound: boolean; problems: string[] }>;
  watchFn?: (opts: { signal: AbortSignal }) => AsyncIterable<MusicEvent>;
  sleepFn?: (ms: number) => Promise<void>;
  log?: (msg: string) => void;
  warn?: (msg: string) => void;
};

let state: MusicState = { track: null, playing: false, changedAtMs: 0 };
let active = false;
let controller: AbortController | null = null;

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
  } else if (ev.event === 'state') {
    state = { ...state, track: ev.track, playing: ev.playing };
  } else {
    state = { track: null, playing: false, changedAtMs: state.changedAtMs };
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
  const watchFn = deps.watchFn ?? watch;
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
}
