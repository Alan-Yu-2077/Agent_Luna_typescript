import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import type { NowPlaying } from '@luna/music-cli';
import { migrate } from '../../sql';
import { setMemoryDb } from '../../memory/sessionStore';
import {
  COMMENT_MAX_CHARS,
  enrichTrack,
  hotCommentFor,
  lyricLinesAt,
  fullLyricsFor,
  musicEnrichEnabled,
  normName,
  parseLrc,
  pickMatch,
  type FetchLike,
} from './enrichment';
import { musicSeedFor } from '../../proactive/musicMoment';

// v0.45.3 — the enrichment layer's three disciplines, pinned: the confidence gate built from the
// research payloads (the delisted-catalog knockoff flood MUST match nothing), the once-ever cache
// (negatives included), and total failure isolation (a dead upstream costs nothing but words).

const ENV = ['LUNA_MUSIC_ENRICH'];
const saved: Record<string, string | undefined> = {};

let db: Database;
beforeEach(() => {
  for (const k of ENV) saved[k] = Bun.env[k];
  db = new Database(':memory:', { strict: true });
  migrate(db, join(import.meta.dir, '..', '..', 'migrations'));
  setMemoryDb(db);
  Bun.env['LUNA_MUSIC_ENRICH'] = '1';
});
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete Bun.env[k];
    else Bun.env[k] = saved[k];
  }
  setMemoryDb(null);
  db.close(false);
});

function fakeTrack(over: Partial<NowPlaying> = {}): NowPlaying {
  return {
    id: 'id-guyongzhe',
    sessionId: null,
    title: '孤勇者',
    artist: '陈奕迅',
    album: '孤勇者',
    duration: 256,
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

// Captured 2026-08-08 (research.md): the licensed-catalog result — original first, knockoff at #2.
const GUYONGZHE_SONGS = [
  { id: 1901371647, name: '孤勇者', duration: 256000, artists: [{ name: '陈奕迅' }] },
  { id: 1985221664, name: '孤勇者 (Live版)', duration: 260000, artists: [{ name: '陈奕迅' }] },
  { id: 3391057255, name: '孤勇者', duration: 254000, artists: [{ name: '陈奕迅-' }, { name: 'MissG' }] },
];

// Captured 2026-08-08: the delisted-catalog flood — every entry a mimicry variant.
const QINGTIAN_FLOOD = [
  { id: 3339230677, name: '晴天', duration: 269000, artists: [{ name: '周杰伦-' }, { name: 'A-LNK' }] },
  { id: 3334653818, name: '晴天', duration: 268000, artists: [{ name: '周杰伦.' }, { name: 'Asasblue' }] },
  { id: 3344811140, name: '晴天(正式版)', duration: 270000, artists: [{ name: '周杰伦.' }, { name: '阿图表妹' }] },
  { id: 3324852509, name: '晴天', duration: 267000, artists: [{ name: 'B-KLl' }, { name: '周杰伦、' }] },
];

function searchPayload(songs: unknown[]): unknown {
  return { result: { songs } };
}

const LRC =
  '[00:00.000] 作词 : 唐恬\n[00:01.000] 作曲 : 钱雷\n' +
  '[00:28.000]都是勇敢的\n[00:33.500]你额头的伤口 你的不同 你犯的错\n[00:39.000]都不必隐藏\n';

function fetchStub(routes: { search?: unknown; lyric?: unknown; comments?: unknown }, count: { n: number }): FetchLike {
  return async (url) => {
    count.n += 1;
    const body = url.includes('/api/search/')
      ? routes.search
      : url.includes('/api/song/lyric')
        ? routes.lyric
        : routes.comments;
    if (body === undefined) throw new Error(`unrouted: ${url}`);
    return new Response(JSON.stringify(body), { status: 200 });
  };
}

describe('the confidence gate (pure, on research payloads)', () => {
  test('licensed catalog: the original matches, exactly', () => {
    const m = pickMatch(
      { title: '孤勇者', artist: '陈奕迅', duration: 256 },
      GUYONGZHE_SONGS.map((s) => ({
        id: s.id,
        name: s.name,
        artists: s.artists.map((a) => a.name),
        durationMs: s.duration,
      })),
    );
    expect(m?.id).toBe(1901371647);
  });

  test('the knockoff flood matches NOTHING (宁缺勿错)', () => {
    const m = pickMatch(
      { title: '晴天', artist: '周杰伦', duration: 269 },
      QINGTIAN_FLOOD.map((s) => ({
        id: s.id,
        name: s.name,
        artists: s.artists.map((a) => a.name),
        durationMs: s.duration,
      })),
    );
    expect(m).toBeNull(); // "周杰伦-" ≠ "周杰伦", feat partners break joined equality
  });

  test('duration outside ±3s rejects an otherwise-exact candidate', () => {
    const m = pickMatch({ title: 'x', artist: 'y', duration: 100 }, [
      { id: 1, name: 'x', artists: ['y'], durationMs: 104_500 },
    ]);
    expect(m).toBeNull();
    const ok = pickMatch({ title: 'x', artist: 'y', duration: 100 }, [
      { id: 1, name: 'x', artists: ['y'], durationMs: 102_000 },
    ]);
    expect(ok?.id).toBe(1);
  });

  test('unknown durations skip the check instead of failing it', () => {
    expect(
      pickMatch({ title: 'x', artist: 'y', duration: null }, [
        { id: 1, name: 'x', artists: ['y'], durationMs: 999_999 },
      ])?.id,
    ).toBe(1);
  });

  test('normName collapses case/whitespace but preserves the knockoff tells', () => {
    expect(normName('  Hello  World ')).toBe('hello world');
    expect(normName('周杰伦-')).not.toBe(normName('周杰伦'));
  });
});

describe('LRC parsing and line lookup', () => {
  test('credits are filtered; lines sorted; position picks ≤2 lines', () => {
    const lines = parseLrc(LRC);
    expect(lines.length).toBe(3); // the two 作词/作曲 credit lines dropped
    expect(lyricLinesAt(lines, 29)).toEqual(['都是勇敢的']);
    expect(lyricLinesAt(lines, 35)).toEqual(['都是勇敢的', '你额头的伤口 你的不同 你犯的错']);
    expect(lyricLinesAt(lines, 10)).toEqual([]); // before the first sung line
  });

  test('an untimestamped lyric degrades to nothing', () => {
    expect(parseLrc('just plain text\nno stamps here')).toEqual([]);
    expect(lyricLinesAt([], 40)).toEqual([]);
  });
});

describe('the once-ever cache', () => {
  test('first enrich = 3 requests; replay = 0; reads come from SQLite', async () => {
    const count = { n: 0 };
    const f = fetchStub(
      {
        search: searchPayload(GUYONGZHE_SONGS),
        lyric: { lrc: { lyric: LRC } },
        comments: { hotComments: [{ content: '这是热评', likedCount: 9 }] },
      },
      count,
    );
    await enrichTrack(fakeTrack(), f);
    expect(count.n).toBe(3);
    await enrichTrack(fakeTrack(), f);
    expect(count.n).toBe(3); // cache hit — zero network
    expect(hotCommentFor('id-guyongzhe')).toBe('这是热评');
    // v0.45.8 (D5): the delivery end changed — the whole cached lyric, once, not per-turn slices.
    expect(fullLyricsFor('id-guyongzhe')).toEqual(['都是勇敢的', '你额头的伤口 你的不同 你犯的错', '都不必隐藏']);
  });

  test('a confident no-match is cached as a negative — one search, never again', async () => {
    const count = { n: 0 };
    const f = fetchStub({ search: searchPayload(QINGTIAN_FLOOD) }, count);
    const t = fakeTrack({ id: 'id-qingtian', title: '晴天', artist: '周杰伦', duration: 269 });
    await enrichTrack(t, f);
    expect(count.n).toBe(1); // search only — no id to fetch lyric/comments for
    await enrichTrack(t, f);
    expect(count.n).toBe(1);
    expect(hotCommentFor('id-qingtian')).toBeNull();
    expect(fullLyricsFor('id-qingtian')).toBeNull();
  });

  test('a search FAILURE leaves no row, so a later change retries', async () => {
    const count = { n: 0 };
    const dead: FetchLike = async () => {
      count.n += 1;
      throw new Error('network down');
    };
    await enrichTrack(fakeTrack(), dead);
    expect(count.n).toBe(1);
    const f = fetchStub(
      {
        search: searchPayload(GUYONGZHE_SONGS),
        lyric: { lrc: { lyric: LRC } },
        comments: { hotComments: [] },
      },
      count,
    );
    await enrichTrack(fakeTrack(), f);
    expect(count.n).toBe(4); // 1 failed + 3 fresh
  });
});

describe('failure isolation — the version can die without a trace', () => {
  test('all-throwing fetch: enrichTrack resolves, consumers stay empty, nothing throws', async () => {
    const dead: FetchLike = async () => {
      throw new Error('upstream gone');
    };
    await enrichTrack(fakeTrack(), dead);
    expect(hotCommentFor('id-guyongzhe')).toBeNull();
    expect(fullLyricsFor('id-guyongzhe')).toBeNull();
  });

  test('a matched song whose lyric/comment legs both fail still caches the id', async () => {
    let searches = 0;
    const f: FetchLike = async (url) => {
      if (url.includes('/api/search/')) {
        searches += 1;
        return new Response(JSON.stringify(searchPayload(GUYONGZHE_SONGS)), { status: 200 });
      }
      throw new Error('leg down');
    };
    await enrichTrack(fakeTrack(), f);
    await enrichTrack(fakeTrack(), f);
    expect(searches).toBe(1); // cached despite the dead legs
    expect(fullLyricsFor('id-guyongzhe')).toBeNull();
  });
});

describe('flag off = zero everything', () => {
  test('LUNA_MUSIC_ENRICH unset: no fetch, no rows, null consumers', async () => {
    delete Bun.env['LUNA_MUSIC_ENRICH'];
    expect(musicEnrichEnabled()).toBe(false);
    const count = { n: 0 };
    await enrichTrack(fakeTrack(), fetchStub({}, count));
    expect(count.n).toBe(0);
    expect(hotCommentFor('id-guyongzhe')).toBeNull();
    expect(fullLyricsFor('id-guyongzhe')).toBeNull();
  });
});

describe('the seed consumer', () => {
  test('hot comments are truncated to the cap and ride the seed', async () => {
    const long = '好'.repeat(COMMENT_MAX_CHARS + 20);
    const count = { n: 0 };
    await enrichTrack(
      fakeTrack(),
      fetchStub(
        {
          search: searchPayload(GUYONGZHE_SONGS),
          lyric: { lrc: { lyric: '' } },
          comments: { hotComments: [{ content: long, likedCount: 1 }] },
        },
        count,
      ),
    );
    const c = hotCommentFor('id-guyongzhe');
    expect(c?.length).toBe(COMMENT_MAX_CHARS + 1); // cap + ellipsis
    expect(c?.endsWith('…')).toBe(true);
    const seed = musicSeedFor(fakeTrack(), c);
    expect(seed).toContain('top comments');
    expect(seed).toContain('…');
    // and without a comment the seed is byte-identical to v0.45.2's
    expect(musicSeedFor(fakeTrack(), null)).not.toContain('top comments');
  });
});
