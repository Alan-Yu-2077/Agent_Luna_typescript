import { afterEach, describe, expect, test } from 'bun:test';
import type { NowPlaying } from '@luna/music-cli';
import { musicControlTool, musicNowTool } from './music';
import { musicEnabled, musicTools, withMusic } from '../registry';
import { proactiveRiskOf } from '../../proactive/safetyGate';
import { applyMusicEvent, startNowPlaying, stopNowPlaying } from '../media/nowPlaying';

// v0.45.0 — the read/control pair. The plan's most important assertion lives here: the risk
// marks. music_now explicitly opted into 'safe'; music_control is UNMARKED so the fail-closed
// gate resolves it to 'surface'. If a future version marks the control tool safe, she becomes
// able to silently skip his songs in proactive turns — this test is the tripwire.

const ctx = () => ({
  sessionId: 'test',
  callId: 'c1',
  abortSignal: new AbortController().signal,
});

async function runTool(
  tool: { execute: (i: unknown, c: ReturnType<typeof ctx>) => AsyncGenerator<unknown> },
  input: unknown,
): Promise<Array<Record<string, unknown>>> {
  const events: Array<Record<string, unknown>> = [];
  for await (const e of tool.execute(input, ctx())) events.push(e as Record<string, unknown>);
  return events;
}

function fakeTrack(over: Partial<NowPlaying> = {}): NowPlaying {
  return {
    id: 'abc123',
    sessionId: null,
    title: '晴天',
    artist: '周杰伦',
    album: '叶惠美',
    duration: 269,
    position: 30,
    playing: true,
    playbackRate: 1,
    source: 'com.netease.163music',
    sourceName: 'netease',
    artworkHash: 'deadbeef',
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

afterEach(() => stopNowPlaying());

describe('risk marks (the tripwire)', () => {
  test('music_now explicitly opted into safe', () => {
    expect(musicNowTool.proactiveRisk).toBe('safe');
    expect(proactiveRiskOf(musicNowTool)).toBe('safe');
  });

  test('music_control is unmarked → fail-closed surface', () => {
    expect(musicControlTool.proactiveRisk).toBeUndefined();
    expect(proactiveRiskOf(musicControlTool)).toBe('surface');
  });
});

describe('mount gate (boot-frozen, flag + platform)', () => {
  const base = {};

  test('flag unset → no music tools', () => {
    const prev = Bun.env['LUNA_MUSIC'];
    delete Bun.env['LUNA_MUSIC'];
    try {
      expect(musicEnabled('darwin')).toBe(false);
      expect(Object.keys(withMusic(base, 'darwin'))).toEqual([]);
    } finally {
      if (prev !== undefined) Bun.env['LUNA_MUSIC'] = prev;
    }
  });

  test('flag on + darwin → both tools mounted', () => {
    const prev = Bun.env['LUNA_MUSIC'];
    Bun.env['LUNA_MUSIC'] = '1';
    try {
      expect(musicEnabled('darwin')).toBe(true);
      const r = withMusic(base, 'darwin');
      expect(r['music_now']).toBeDefined();
      expect(r['music_control']).toBeDefined();
    } finally {
      if (prev === undefined) delete Bun.env['LUNA_MUSIC'];
      else Bun.env['LUNA_MUSIC'] = prev;
    }
  });

  test('flag on + win32 → dormant (the CI legs run this for real)', () => {
    const prev = Bun.env['LUNA_MUSIC'];
    Bun.env['LUNA_MUSIC'] = '1';
    try {
      expect(musicEnabled('win32')).toBe(false);
      expect(Object.keys(withMusic(base, 'win32'))).toEqual([]);
    } finally {
      if (prev === undefined) delete Bun.env['LUNA_MUSIC'];
      else Bun.env['LUNA_MUSIC'] = prev;
    }
  });

  test('registry group holds exactly the pair', () => {
    expect(Object.keys(musicTools).sort()).toEqual(['music_control', 'music_now']);
  });
});

describe('dormant provider → recoverable err, never a throw', () => {
  test('music_now', async () => {
    const [e] = await runTool(musicNowTool, {});
    expect(e).toMatchObject({ kind: 'err', recoverable: true });
    expect(String(e?.['message'])).toContain('not available');
  });

  test('music_control', async () => {
    const [e] = await runTool(musicControlTool, { op: 'pause' });
    expect(e).toMatchObject({ kind: 'err', recoverable: true });
  });
});

describe('music_now against a live provider', () => {
  test('playing → snapshot with extrapolated position', async () => {
    await activateProvider();
    applyMusicEvent({ event: 'track', track: fakeTrack() }, Date.now());
    const events = await runTool(musicNowTool, {});
    const ok = events.find((e) => e['kind'] === 'ok');
    expect(ok).toBeDefined();
    const data = ok?.['data'] as Record<string, unknown>;
    expect(data['state']).toBe('playing');
    expect(data['title']).toBe('晴天');
    expect(data['position_s']).toBeGreaterThanOrEqual(30);
    expect(data['duration_s']).toBe(269);
    expect(data['source']).toBe('netease');
  });

  test('idle → explicit idle snapshot, not an error', async () => {
    await activateProvider();
    const events = await runTool(musicNowTool, {});
    const ok = events.find((e) => e['kind'] === 'ok');
    const data = ok?.['data'] as Record<string, unknown>;
    expect(data['state']).toBe('idle');
    expect(data['title']).toBeNull();
  });

  test('output parses through the declared zod shape', async () => {
    await activateProvider();
    applyMusicEvent({ event: 'track', track: fakeTrack({ playing: false, playbackRate: 0 }) }, Date.now());
    const events = await runTool(musicNowTool, {});
    const ok = events.find((e) => e['kind'] === 'ok');
    const parsed = musicNowTool.output.safeParse(ok?.['data']);
    expect(parsed.success).toBe(true);
    expect((parsed.data as Record<string, unknown>)['state']).toBe('paused');
  });
});

describe('music_control input', () => {
  test('op whitelist rejects anything else', () => {
    expect(musicControlTool.input.safeParse({ op: 'next' }).success).toBe(true);
    expect(musicControlTool.input.safeParse({ op: 'stop' }).success).toBe(false);
    expect(musicControlTool.input.safeParse({ op: 'seek' }).success).toBe(false);
    expect(musicControlTool.input.safeParse({}).success).toBe(false);
  });

  test('control is global-serial (external player, no racing commands)', () => {
    expect(musicControlTool.concurrency).toBe('global-serial');
    expect(musicNowTool.concurrency).toBe('safe-parallel');
  });
});
