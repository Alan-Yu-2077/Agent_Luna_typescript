import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MusicNow } from '@luna/protocol';
import { artworkPathFor, musicApiHandler } from './musicApi';
import { applyMusicEvent, startNowPlaying, stopNowPlaying } from '../tools/media/nowPlaying';
import type { NowPlaying } from '@luna/music-cli';

// v0.45.4 — the player card's face. The gate (LUNA_MUSIC off → the handler answers nothing at
// all), the dormant 503, the zod-parsed now payload, the op whitelist, and the traversal-proof
// artwork filename derivation. Platform is injected so both CI legs run every path.

const ENV = ['LUNA_MUSIC'];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV) saved[k] = Bun.env[k];
});
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete Bun.env[k];
    else Bun.env[k] = saved[k];
  }
  stopNowPlaying();
});

function fakeTrack(over: Partial<NowPlaying> = {}): NowPlaying {
  return {
    id: 't1',
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
    artworkHash: 'aabbccdd',
    artworkPath: null,
    liked: null,
    shuffle: null,
    repeat: null,
    sampledAt: new Date().toISOString(),
    ...over,
  };
}

async function activateProvider(): Promise<void> {
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
    log: () => {},
  });
}

const req = (path: string, init?: RequestInit): Request =>
  new Request(`http://127.0.0.1:8787${path}`, init);

describe('the gate', () => {
  test('flag unset → the handler answers nothing (404 by fallthrough)', async () => {
    delete Bun.env['LUNA_MUSIC'];
    expect(await musicApiHandler(req('/api/music/now'), 'darwin')).toBeNull();
  });

  test('flag on but non-darwin → nothing (the CI legs run this for real)', async () => {
    Bun.env['LUNA_MUSIC'] = '1';
    expect(await musicApiHandler(req('/api/music/now'), 'linux')).toBeNull();
    expect(await musicApiHandler(req('/api/music/now'), 'win32')).toBeNull();
  });

  test('unrelated paths fall through even with the face on', async () => {
    Bun.env['LUNA_MUSIC'] = '1';
    expect(await musicApiHandler(req('/api/data/diaries'), 'darwin')).toBeNull();
  });
});

describe('GET /api/music/now', () => {
  test('dormant provider → explicit 503', async () => {
    Bun.env['LUNA_MUSIC'] = '1';
    const res = await musicApiHandler(req('/api/music/now'), 'darwin');
    expect(res?.status).toBe(503);
  });

  test('idle → track:null payload; playing → zod-clean snapshot with extrapolated position', async () => {
    Bun.env['LUNA_MUSIC'] = '1';
    await activateProvider();
    const idle = await musicApiHandler(req('/api/music/now'), 'darwin');
    expect(idle?.status).toBe(200);
    const idleBody = MusicNow.parse(await idle!.json());
    expect(idleBody.track).toBeNull();

    applyMusicEvent({ event: 'track', track: fakeTrack() }, Date.now());
    const res = await musicApiHandler(req('/api/music/now'), 'darwin');
    const body = MusicNow.parse(await res!.json());
    expect(body.track?.title).toBe('海阔天空');
    expect(body.track?.artworkHash).toBe('aabbccdd');
    expect(body.playing).toBe(true);
    expect(body.position).toBeGreaterThanOrEqual(40);
    expect(body.duration).toBe(326);
  });
});

describe('POST /api/music/control', () => {
  test('op outside the whitelist → 400 before any subprocess', async () => {
    Bun.env['LUNA_MUSIC'] = '1';
    await activateProvider();
    const bad = await musicApiHandler(
      req('/api/music/control', {
        method: 'POST',
        body: JSON.stringify({ op: 'stop' }),
        headers: { 'content-type': 'application/json' },
      }),
      'darwin',
    );
    expect(bad?.status).toBe(400);
    const junk = await musicApiHandler(
      req('/api/music/control', { method: 'POST', body: 'not json' }),
      'darwin',
    );
    expect(junk?.status).toBe(400);
  });

  test('dormant → 503, never a spawn', async () => {
    Bun.env['LUNA_MUSIC'] = '1';
    const res = await musicApiHandler(
      req('/api/music/control', {
        method: 'POST',
        body: JSON.stringify({ op: 'pause' }),
        headers: { 'content-type': 'application/json' },
      }),
      'darwin',
    );
    expect(res?.status).toBe(503);
  });
});

describe('artwork filename derivation (traversal-proof)', () => {
  test('valid hash resolves an existing file; junk and traversal never do', () => {
    const dir = mkdtempSync(join(tmpdir(), 'luna-art-'));
    try {
      writeFileSync(join(dir, 'aabbccdd.jpg'), 'x');
      expect(artworkPathFor(dir, 'aabbccdd')).toBe(join(dir, 'aabbccdd.jpg'));
      expect(artworkPathFor(dir, 'ffffffff')).toBeNull(); // valid shape, no file
      expect(artworkPathFor(dir, '../secret')).toBeNull();
      expect(artworkPathFor(dir, '..%2fsecret')).toBeNull();
      expect(artworkPathFor(dir, 'AABBCCDD')).toBeNull(); // uppercase = not our hash
      expect(artworkPathFor(dir, '')).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // v0.45.17 (P2#5): the response used to be a LAZY Bun.file handle, so a track change that
  // swept the old cover between existsSync and the body's fd open tore the image once per skip.
  test('a cover deleted right after the check still serves — no ENOENT window', async () => {
    Bun.env['LUNA_MUSIC'] = '1';
    const dir = mkdtempSync(join(tmpdir(), 'luna-art-race-'));
    const prev = Bun.env['LUNA_MUSIC_ARTWORK_DIR'];
    Bun.env['LUNA_MUSIC_ARTWORK_DIR'] = dir;
    try {
      writeFileSync(join(dir, 'aabbccdd.jpg'), 'JPEGBYTES');
      await activateProvider();
      const res = await musicApiHandler(req('/api/music/artwork?h=aabbccdd'), 'darwin');
      // the sweep lands here — after the handler returned, before the caller reads the body
      rmSync(join(dir, 'aabbccdd.jpg'), { force: true });
      expect(res?.status).toBe(200);
      expect(await res!.text()).toBe('JPEGBYTES');
    } finally {
      if (prev === undefined) delete Bun.env['LUNA_MUSIC_ARTWORK_DIR'];
      else Bun.env['LUNA_MUSIC_ARTWORK_DIR'] = prev;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('unknown artwork hash → 404 from the endpoint', async () => {
    Bun.env['LUNA_MUSIC'] = '1';
    await activateProvider();
    const res = await musicApiHandler(req('/api/music/artwork?h=0123456789abcdef'), 'darwin');
    expect(res?.status).toBe(404);
  });
});
