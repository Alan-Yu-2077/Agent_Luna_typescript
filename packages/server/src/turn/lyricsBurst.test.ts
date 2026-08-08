import { afterEach, describe, expect, test } from 'bun:test';
import type { Lyrics, NowPlaying, TrackAffinity } from '@luna/music-cli';
import {
  LYRICS_MAX_CHARS,
  LYRICS_MAX_LINES,
  affinityPhrase,
  formatLyricsBlock,
  lyricsBurstFor,
  musicBlockFor,
} from './nowPlayingContext';
import {
  applyMusicEvent,
  getMusicEnrichment,
  setEnrichDepsForTests,
  startNowPlaying,
  stopNowPlaying,
} from '../tools/media/nowPlaying';

// v0.45.8 (D5) — the read-once-burn semantics, the version's most important group: the first
// turn after a track change carries the WHOLE lyric exactly once; the resident block carries
// affinity but NEVER lyric lines; off-library nulls degrade to exactly the v0.45.1 block.

const savedEnrich = Bun.env['LUNA_MUSIC_ENRICH'];
afterEach(() => {
  stopNowPlaying();
  setEnrichDepsForTests(null);
  if (savedEnrich === undefined) delete Bun.env['LUNA_MUSIC_ENRICH'];
  else Bun.env['LUNA_MUSIC_ENRICH'] = savedEnrich;
});

function fakeTrack(over: Partial<NowPlaying> = {}): NowPlaying {
  return {
    id: 'trk-a',
    sessionId: null,
    title: '海阔天空',
    artist: 'Beyond',
    album: '乐与怒',
    duration: 326,
    position: 40,
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

function fakeLyrics(n = 4): Lyrics {
  return {
    neteaseId: '347230',
    lines: Array.from({ length: n }, (_, i) => ({
      timeMs: i * 10_000,
      text: `第${i + 1}行歌词`,
      translation: i === 0 ? 'line one' : null,
    })),
    hasTranslation: true,
    synced: true,
  };
}

const AFFINITY: TrackAffinity = { neteaseId: '347230', sessions: 213, listenedSeconds: 165_600, rank: 3 };

async function activate(deps: {
  resolveId?: (t: string, a: string) => string | null;
  affinityFn?: (id: string) => TrackAffinity | null;
  fetchLyricsFn?: (id: string) => Promise<Lyrics | null>;
}): Promise<void> {
  Bun.env['LUNA_MUSIC_ENRICH'] = '1';
  setEnrichDepsForTests(deps);
  await startNowPlaying({
    env: { LUNA_MUSIC: '1' },
    platform: 'darwin',
    doctorFn: async () => ({ binaryFound: true, problems: [] }),
    watchFn: (opts) => ({
      async *[Symbol.asyncIterator]() {
        await new Promise<void>((resolve) =>
          opts.signal.addEventListener('abort', () => resolve(), { once: true }),
        );
      },
    }),
    libraryFactory: () => null, // enrich deps injected; the real library is not opened
    log: () => {},
  });
}

async function playTrack(t: NowPlaying): Promise<void> {
  applyMusicEvent({ event: 'track', track: t }, Date.now());
  await Bun.sleep(5); // let the async lyric fetch settle
}

describe('read-once-burn (D5)', () => {
  test('first turn after a change: exactly one full-lyrics block; second turn: none', async () => {
    await activate({
      resolveId: () => '347230',
      affinityFn: () => AFFINITY,
      fetchLyricsFn: async () => fakeLyrics(),
    });
    await playTrack(fakeTrack());

    const first = lyricsBurstFor();
    expect(first).not.toBeNull();
    expect(first!).toContain('Full lyrics of "海阔天空"');
    expect(first!).toContain('第1行歌词 / line one'); // translation rides inline
    expect(first!).toContain('provided once');
    expect(lyricsBurstFor()).toBeNull(); // burned
  });

  test('a NEW track re-arms the delivery', async () => {
    await activate({
      resolveId: () => '347230',
      affinityFn: () => AFFINITY,
      fetchLyricsFn: async () => fakeLyrics(),
    });
    await playTrack(fakeTrack());
    expect(lyricsBurstFor()).not.toBeNull();
    await playTrack(fakeTrack({ id: 'trk-b', title: '光辉岁月' }));
    const second = lyricsBurstFor();
    expect(second).not.toBeNull();
    expect(second!).toContain('光辉岁月');
  });

  test('off-library track (resolveId null): no lyric fetch, no block, no error', async () => {
    let fetches = 0;
    await activate({
      resolveId: () => null,
      affinityFn: () => {
        throw new Error('must not be called without an id');
      },
      fetchLyricsFn: async () => {
        fetches += 1;
        return fakeLyrics();
      },
    });
    await playTrack(fakeTrack());
    expect(fetches).toBe(0);
    expect(getMusicEnrichment()?.neteaseId).toBeNull();
    expect(lyricsBurstFor()).toBeNull();
  });

  test('LUNA_MUSIC_ENRICH off: id + affinity still resolve, lyrics never fetched', async () => {
    let fetches = 0;
    await activate({
      resolveId: () => '347230',
      affinityFn: () => AFFINITY,
      fetchLyricsFn: async () => {
        fetches += 1;
        return fakeLyrics();
      },
    });
    delete Bun.env['LUNA_MUSIC_ENRICH'];
    await playTrack(fakeTrack({ id: 'trk-c' }));
    expect(fetches).toBe(0);
    expect(getMusicEnrichment()?.affinity?.sessions).toBe(213);
    expect(lyricsBurstFor()).toBeNull();
  });

  test('the lyric fetch fires ONCE per change (D4) and a late result for a superseded track drops', async () => {
    let fetches = 0;
    let release!: (l: Lyrics | null) => void;
    await activate({
      resolveId: () => '347230',
      affinityFn: () => AFFINITY,
      fetchLyricsFn: () => {
        fetches += 1;
        if (fetches === 1) return new Promise((r) => (release = r)); // slow first fetch
        return Promise.resolve(fakeLyrics());
      },
    });
    await playTrack(fakeTrack()); // fetch 1 in flight
    await playTrack(fakeTrack({ id: 'trk-b', title: '光辉岁月' })); // supersedes
    release(fakeLyrics()); // late result for trk-a
    await Bun.sleep(5);
    expect(fetches).toBe(2);
    expect(getMusicEnrichment()?.trackId).toBe('trk-b'); // late write dropped
  });
});

describe('the resident block (D5 negative + affinity)', () => {
  test('carries the affinity sentence, NEVER lyric lines', async () => {
    await activate({
      resolveId: () => '347230',
      affinityFn: () => AFFINITY,
      fetchLyricsFn: async () => fakeLyrics(),
    });
    await playTrack(fakeTrack());
    const block = musicBlockFor();
    expect(block).toContain('He knows this one well: 213 plays, about 46 hours of listening — his #3 most-played overall.');
    expect(block).not.toContain('歌词');
    expect(block).not.toContain('第1行');
    // and it stays in the block on EVERY turn (unlike the lyrics, it is resident)
    lyricsBurstFor();
    expect(musicBlockFor()).toContain('He knows this one well');
  });

  test('null affinity → byte-identical to the v0.45.1 block (backward-compat pin)', async () => {
    await activate({
      resolveId: () => null,
      fetchLyricsFn: async () => null,
    });
    const t = fakeTrack({ position: 100, sampledAt: new Date().toISOString() });
    await playTrack(t);
    const block = musicBlockFor();
    expect(block).toMatch(/^Music the user is playing right now: "海阔天空" by Beyond \(album "乐与怒"\) — around the middle\.$/);
  });

  test('zero-session affinity (library row without plays) is silently omitted', () => {
    expect(affinityPhrase({ neteaseId: 'x', sessions: 0, listenedSeconds: 0, rank: null })).toBeNull();
  });
});

describe('the cap guardrail', () => {
  test('long lyrics truncate at the line cap with a marker', () => {
    const lines = Array.from({ length: LYRICS_MAX_LINES + 20 }, (_, i) => `line ${i}`);
    const block = formatLyricsBlock('x', 'y', lines);
    expect(block).toContain('…(truncated)');
    expect(block.split('\n').length).toBeLessThanOrEqual(LYRICS_MAX_LINES + 3);
  });

  test('very long text truncates at the char cap', () => {
    const block = formatLyricsBlock('x', 'y', ['好'.repeat(LYRICS_MAX_CHARS * 2)]);
    expect(block.length).toBeLessThanOrEqual(LYRICS_MAX_CHARS + 200);
    expect(block).toContain('…(truncated)');
  });
});
