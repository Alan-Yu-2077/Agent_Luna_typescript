import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { Library, type Lyrics } from '@luna/music-cli';
import { musicLibraryTool, musicLyricsTool } from './musicLibrary';
import { musicTools } from '../registry';
import { proactiveRiskOf } from '../../proactive/safetyGate';
import {
  applyMusicEvent,
  setEnrichDepsForTests,
  startNowPlaying,
  stopNowPlaying,
} from '../media/nowPlaying';
import type { NowPlaying } from '@luna/music-cli';

// v0.45.9 — her record-shelf permission, pinned: read-only ops over a tmpdir mirror of the real
// NetEase schema (the upstream test's infrastructure, M6), 'safe' risk marks as the deliberate
// counterpart to music_control's fail-closed surface, recoverable errs when the shelf is absent,
// and bounded summaries so top(10) never becomes a token spill.

const DB_PATH = join(tmpdir(), `luna-musiclib-tool-test-${process.pid}.sqlite3`);

function trackJson(id: string, name: string, artist: string) {
  return JSON.stringify({
    id,
    name,
    fee: 0,
    duration: 200000,
    artists: [{ name: artist }],
    album: { name: `${name} - album`, picUrl: null },
  });
}

beforeAll(() => {
  const db = new Database(DB_PATH);
  db.run(`CREATE TABLE dbTrack (id VARCHAR(40) PRIMARY KEY, jsonStr TEXT)`);
  db.run(
    `CREATE TABLE playingCount (resourceId VARCHAR(40), playDuration BIGINT, id INTEGER PRIMARY KEY AUTOINCREMENT)`,
  );
  db.run(`CREATE TABLE historyTracks (playtime BIGINT, id VARCHAR(40) PRIMARY KEY, jsonStr TEXT)`);
  db.run(`CREATE TABLE historyPlaylists (playtime BIGINT, id VARCHAR(40) PRIMARY KEY, jsonStr TEXT)`);
  db.run(`INSERT INTO dbTrack VALUES (?,?)`, ['100', trackJson('100', 'Supernatural', 'noli')]);
  db.run(`INSERT INTO dbTrack VALUES (?,?)`, ['200', trackJson('200', 'Mihe Dance', 'vanbird')]);
  db.run(`INSERT INTO playingCount (resourceId, playDuration) VALUES ('100', 500)`);
  db.run(`INSERT INTO playingCount (resourceId, playDuration) VALUES ('100', 7000)`);
  db.run(`INSERT INTO playingCount (resourceId, playDuration) VALUES ('200', 100)`);
  db.run(`INSERT INTO historyTracks VALUES (?,?,?)`, [2000, '200', trackJson('200', 'Mihe Dance', 'vanbird')]);
  db.run(`INSERT INTO historyTracks VALUES (?,?,?)`, [1000, '100', trackJson('100', 'Supernatural', 'noli')]);
  db.run(`INSERT INTO historyPlaylists VALUES (?,?,?)`, [
    1,
    '9001',
    JSON.stringify({ id: '9001', name: '学习的vibe', trackCount: 13 }),
  ]);
  db.close();
});
afterAll(() => {
  for (const suffix of ['', '-shm', '-wal']) rmSync(DB_PATH + suffix, { force: true });
});
afterEach(() => {
  stopNowPlaying();
  setEnrichDepsForTests(null);
});

const ctx = () => ({ sessionId: 'test', callId: 'c1', abortSignal: new AbortController().signal });

async function run(
  tool: { execute: (i: unknown, c: ReturnType<typeof ctx>) => AsyncGenerator<unknown> },
  input: unknown,
): Promise<Record<string, unknown>> {
  const events: Array<Record<string, unknown>> = [];
  for await (const e of tool.execute(input, ctx())) events.push(e as Record<string, unknown>);
  return events[events.length - 1]!;
}

async function activateWithMirror(): Promise<void> {
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
    libraryFactory: () => new Library(DB_PATH),
    log: () => {},
  });
}

function fakeTrack(over: Partial<NowPlaying> = {}): NowPlaying {
  return {
    id: 'trk-a',
    sessionId: null,
    title: 'Supernatural',
    artist: 'noli',
    album: 'Supernatural - album',
    duration: 200,
    position: 10,
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

describe('risk marks (the safe counterpart)', () => {
  test('both shelf tools explicitly safe; the registry quad is complete', () => {
    expect(proactiveRiskOf(musicLibraryTool)).toBe('safe');
    expect(proactiveRiskOf(musicLyricsTool)).toBe('safe');
    expect(Object.keys(musicTools).sort()).toEqual([
      'music_control',
      'music_library',
      'music_lyrics',
      'music_now',
    ]);
  });
});

describe('music_library over the tmpdir mirror', () => {
  test('top: ranked by listening time with minutes attached', async () => {
    await activateWithMirror();
    const e = await run(musicLibraryTool, { op: 'top' });
    expect(e['kind']).toBe('ok');
    const data = e['data'] as { op: string; items: Array<Record<string, unknown>> };
    expect(data.items[0]).toMatchObject({ title: 'Supernatural', artist: 'noli', sessions: 2, listened_min: 125 });
    expect(musicLibraryTool.output.safeParse(data).success).toBe(true);
  });

  test('search finds by substring; empty query is a recoverable err', async () => {
    await activateWithMirror();
    const ok = await run(musicLibraryTool, { op: 'search', query: 'mihe' });
    const data = ok['data'] as { items: Array<{ title: string }> };
    expect(data.items.map((i) => i.title)).toEqual(['Mihe Dance']);
    const bad = await run(musicLibraryTool, { op: 'search' });
    expect(bad).toMatchObject({ kind: 'err', recoverable: true });
  });

  test('history is most-recent-first; playlists carry track counts', async () => {
    await activateWithMirror();
    const h = (await run(musicLibraryTool, { op: 'history' }))['data'] as { items: Array<{ title: string }> };
    expect(h.items.map((i) => i.title)).toEqual(['Mihe Dance', 'Supernatural']);
    const p = (await run(musicLibraryTool, { op: 'playlists' }))['data'] as {
      items: Array<{ title: string; track_count: number | null }>;
    };
    expect(p.items[0]).toMatchObject({ title: '学习的vibe', track_count: 13 });
  });

  test('provider dormant / no library → recoverable err, never a throw', async () => {
    const e = await run(musicLibraryTool, { op: 'top' });
    expect(e).toMatchObject({ kind: 'err', recoverable: true });
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
      libraryFactory: () => null, // no local client library
      log: () => {},
    });
    const e2 = await run(musicLibraryTool, { op: 'top' });
    expect(e2).toMatchObject({ kind: 'err', recoverable: true });
  });

  test('summaries stay bounded (top 10 never becomes a token spill)', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      kind: 'track' as const,
      title: `很长很长的歌名第${i}号`,
      artist: '歌手',
      album: null,
      sessions: 3,
      listened_min: 120,
      played_at_ms: null,
      track_count: null,
    }));
    const s = musicLibraryTool.summarize({ op: 'top', count: 10, items });
    expect(s.length).toBeLessThan(300);
    expect(s).toContain('(+5 more)');
  });
});

describe('music_lyrics (the re-read safety net)', () => {
  test('reads the provider cache, zero network; nothing playing / no lyrics → recoverable errs', async () => {
    const lyrics: Lyrics = {
      neteaseId: '100',
      lines: [
        { timeMs: 0, text: '第一行', translation: 'line one' },
        { timeMs: 10_000, text: '第二行', translation: null },
      ],
      hasTranslation: true,
      synced: true,
    };
    Bun.env['LUNA_MUSIC_ENRICH'] = '1';
    setEnrichDepsForTests({
      resolveId: () => '100',
      affinityFn: () => null,
      fetchLyricsFn: async () => lyrics,
    });
    await activateWithMirror();

    const before = await run(musicLyricsTool, {});
    expect(before).toMatchObject({ kind: 'err', recoverable: true }); // nothing playing yet

    applyMusicEvent({ event: 'track', track: fakeTrack() }, Date.now());
    await Bun.sleep(5);
    const e = await run(musicLyricsTool, {});
    expect(e['kind']).toBe('ok');
    const data = e['data'] as { title: string; lines: string[]; truncated: boolean };
    expect(data.lines).toEqual(['第一行 / line one', '第二行']);
    expect(data.truncated).toBe(false);
    delete Bun.env['LUNA_MUSIC_ENRICH'];
  });
});
