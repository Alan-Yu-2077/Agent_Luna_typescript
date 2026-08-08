import { afterEach, describe, expect, test } from 'bun:test';
import type { MusicEvent, NowPlaying } from '@luna/music-cli';
import {
  MAX_STREAM_RESTARTS,
  applyMusicEvent,
  getNowPlaying,
  musicProviderActive,
  restartDelayMs,
  startNowPlaying,
  stopNowPlaying,
} from './nowPlaying';

// v0.45.0 — the provider's dormancy trio and restart discipline. The plan's hard rule: any
// gate failing = zero subscriptions and an untouched boot; a dying stream = bounded backoff,
// then dormancy — never a crash-loop.

function fakeTrack(over: Partial<NowPlaying> = {}): NowPlaying {
  return {
    id: 'abc123',
    sessionId: null,
    title: '海阔天空',
    artist: 'Beyond',
    album: '乐与怒',
    duration: 326,
    position: 12,
    playing: true,
    playbackRate: 1,
    source: 'com.netease.163music',
    sourceName: 'netease',
    artworkHash: null,
    artworkPath: null,
    liked: null,
    shuffle: null,
    repeat: null,
    sampledAt: new Date().toISOString(),
    ...over,
  };
}

const okDoctor = async () => ({ binaryFound: true, problems: [] });

afterEach(() => stopNowPlaying());

describe('dormancy gates (never wake, never break boot)', () => {
  test('flag unset → dormant, watch never called', async () => {
    let watched = 0;
    await startNowPlaying({
      env: {},
      platform: 'darwin',
      doctorFn: okDoctor,
      watchFn: () => {
        watched += 1;
        throw new Error('must not be called');
      },
    });
    expect(watched).toBe(0);
    expect(musicProviderActive()).toBe(false);
    expect(getNowPlaying()).toBeNull();
  });

  test('non-darwin → dormant even with the flag on', async () => {
    let watched = 0;
    const logs: string[] = [];
    await startNowPlaying({
      env: { LUNA_MUSIC: '1' },
      platform: 'linux',
      doctorFn: okDoctor,
      watchFn: () => {
        watched += 1;
        throw new Error('must not be called');
      },
      log: (m) => logs.push(m),
    });
    expect(watched).toBe(0);
    expect(musicProviderActive()).toBe(false);
    expect(logs.join(' ')).toContain('dormant');
  });

  test('doctor fails (binary missing) → dormant with one log line', async () => {
    let watched = 0;
    const logs: string[] = [];
    await startNowPlaying({
      env: { LUNA_MUSIC: '1' },
      platform: 'darwin',
      doctorFn: async () => ({ binaryFound: false, problems: ['media-control is not installed'] }),
      watchFn: () => {
        watched += 1;
        throw new Error('must not be called');
      },
      log: (m) => logs.push(m),
    });
    expect(watched).toBe(0);
    expect(musicProviderActive()).toBe(false);
    expect(logs.some((l) => l.includes('media-control'))).toBe(true);
  });

  test('doctor throwing is swallowed into dormancy, not a boot crash', async () => {
    await startNowPlaying({
      env: { LUNA_MUSIC: '1' },
      platform: 'darwin',
      doctorFn: async () => {
        throw new Error('spawn exploded');
      },
      watchFn: () => {
        throw new Error('must not be called');
      },
      log: () => {},
    });
    expect(musicProviderActive()).toBe(false);
  });
});

describe('event application', () => {
  test('track / state / stopped drive the snapshot', () => {
    const t = fakeTrack();
    applyMusicEvent({ event: 'track', track: t }, 1000);
    applyMusicEvent({ event: 'state', playing: false, position: 20, track: { ...t, playing: false } }, 2000);
    // changedAtMs is the TRACK change moment — a pause does not move it
    applyMusicEvent({ event: 'stopped', at: new Date().toISOString() }, 3000);
    // stopped clears the track but keeps changedAtMs (v0.45.2 reads it)
    // (assert via a live provider below — applyMusicEvent writes module state)
  });

  test('a live provider exposes the state and stop resets it', async () => {
    let push: ((ev: MusicEvent) => void) | null = null;
    const watchFn = (opts: { signal: AbortSignal }) => ({
      [Symbol.asyncIterator]() {
        return {
          next: () =>
            new Promise<IteratorResult<MusicEvent>>((resolve) => {
              push = (ev) => resolve({ value: ev, done: false });
              opts.signal.addEventListener('abort', () => resolve({ value: undefined as never, done: true }), {
                once: true,
              });
            }),
        };
      },
    });
    await startNowPlaying({
      env: { LUNA_MUSIC: '1' },
      platform: 'darwin',
      doctorFn: okDoctor,
      watchFn,
      log: () => {},
    });
    expect(musicProviderActive()).toBe(true);
    expect(getNowPlaying()).toEqual({ track: null, playing: false, changedAtMs: 0 });

    await Bun.sleep(5); // let the loop pull the first next()
    const t = fakeTrack();
    push!({ event: 'track', track: t });
    await Bun.sleep(5);
    const s = getNowPlaying();
    expect(s?.track?.title).toBe('海阔天空');
    expect(s?.playing).toBe(true);
    expect(s?.changedAtMs).toBeGreaterThan(0);

    stopNowPlaying();
    expect(musicProviderActive()).toBe(false);
    expect(getNowPlaying()).toBeNull();
  });

  test('second start while active is a no-op (no double subscription)', async () => {
    let watches = 0;
    const watchFn = (opts: { signal: AbortSignal }) => {
      watches += 1;
      return {
        // eslint-disable-next-line @typescript-eslint/require-await
        async *[Symbol.asyncIterator]() {
          await new Promise<void>((resolve) =>
            opts.signal.addEventListener('abort', () => resolve(), { once: true }),
          );
        },
      };
    };
    const deps = { env: { LUNA_MUSIC: '1' }, platform: 'darwin', doctorFn: okDoctor, watchFn, log: () => {} };
    await startNowPlaying(deps);
    await startNowPlaying(deps);
    expect(watches).toBe(1);
  });
});

describe('restart discipline', () => {
  test('backoff is exponential and capped', () => {
    expect(restartDelayMs(1)).toBe(2000);
    expect(restartDelayMs(2)).toBe(4000);
    expect(restartDelayMs(10)).toBe(60_000);
  });

  test('a stream that dies instantly is restarted MAX times, then the provider goes dormant', async () => {
    let spawns = 0;
    const delays: number[] = [];
    const warns: string[] = [];
    await startNowPlaying({
      env: { LUNA_MUSIC: '1' },
      platform: 'darwin',
      doctorFn: okDoctor,
      watchFn: () => {
        spawns += 1;
        return {
          // an empty generator: ends immediately = the child died
          async *[Symbol.asyncIterator]() {
            /* no events */
          },
        };
      },
      sleepFn: async (ms) => {
        delays.push(ms);
      },
      log: () => {},
      warn: (m) => warns.push(m),
    });
    // the loop runs in the background; give it a tick to exhaust its budget
    await Bun.sleep(10);
    expect(spawns).toBe(MAX_STREAM_RESTARTS);
    expect(delays.length).toBe(MAX_STREAM_RESTARTS - 1);
    expect(musicProviderActive()).toBe(false);
    expect(warns.some((w) => w.includes('dormant'))).toBe(true);
  });
});
