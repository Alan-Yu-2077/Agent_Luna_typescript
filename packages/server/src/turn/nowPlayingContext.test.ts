import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type Anthropic from '@anthropic-ai/sdk';
import type { NowPlaying } from '@luna/music-cli';
import type { ProviderEvent } from '../provider/types';
import { MockProvider } from '../provider/mock';
import { getSession, resetSessions } from './session';
import { buildSystemPrompt, runTurn } from './runTurn';
import {
  buildMusicBlock,
  musicAmbientEnabled,
  musicBlockFor,
  musicFactsOf,
  progressPhase,
  trackPhrase,
  type MusicFacts,
} from './nowPlayingContext';
import { applyMusicEvent, startNowPlaying, stopNowPlaying } from '../tools/media/nowPlaying';

// v0.45.1 — she knows without asking. The block is a pure formatter over the resident
// provider's memory; the tests pin the three states, the coarse progress wording, the artwork
// firewall, and the cache boundary (volatile → uncached user tail, never the system block).

const ENV = ['LUNA_MUSIC_AMBIENT', 'LUNA_PERSONA', 'LUNA_MEMORY_INJECT'];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV) saved[k] = Bun.env[k];
  resetSessions();
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
    id: 'abc123',
    sessionId: null,
    title: '富士山下',
    artist: '陈奕迅',
    album: "What's Going On…?",
    duration: 259,
    position: 100,
    playing: true,
    playbackRate: 1,
    source: 'com.netease.163music',
    sourceName: 'netease',
    artworkHash: 'cafebabe',
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

function facts(over: Partial<MusicFacts> = {}): MusicFacts {
  return {
    title: '富士山下',
    artist: '陈奕迅',
    album: "What's Going On…?",
    playing: true,
    positionS: 100,
    durationS: 259,
    sourceName: 'netease',
    ...over,
  };
}

function stopEnd(text: string): ProviderEvent {
  const assistantContent = [{ type: 'text', text }] as unknown as Anthropic.ContentBlock[];
  return {
    kind: 'message_stop',
    stopReason: 'end_turn',
    toolUses: [],
    assistantContent,
    usage: { input_tokens: 20, output_tokens: 5 },
  };
}

async function userTextsOf(): Promise<string[]> {
  const provider = new MockProvider([[{ kind: 'text_delta', text: 'hi' }, stopEnd('hi')]]);
  const session = getSession('test');
  await runTurn({ session, turnId: 't1', userText: 'hello', provider, registry: {}, emit: () => {} });
  const content = provider.requests[0]?.messages.find((m) => m.role === 'user')?.content;
  if (!Array.isArray(content)) return [];
  return content
    .filter((b): b is Anthropic.TextBlockParam => b.type === 'text')
    .map((b) => b.text);
}

describe('progressPhase — coarse on purpose', () => {
  test('three phases with stable boundaries', () => {
    expect(progressPhase(5, 259)).toBe('start'); // <30s
    expect(progressPhase(35, 259)).toBe('start'); // <15%
    expect(progressPhase(100, 259)).toBe('middle');
    expect(progressPhase(240, 259)).toBe('end'); // <30s left
    expect(progressPhase(230, 259)).toBe('end'); // >85%
  });

  test('no duration → no phase (streams, radio)', () => {
    expect(progressPhase(100, null)).toBeNull();
    expect(progressPhase(100, 0)).toBeNull();
  });
});

describe('buildMusicBlock — a finished, labeled fact', () => {
  test('playing, middle', () => {
    const s = buildMusicBlock(facts());
    expect(s).toBe(
      'Music the user is playing right now: "富士山下" by 陈奕迅 (album "What\'s Going On…?") — around the middle.',
    );
  });

  test('paused carries the stopped wording', () => {
    const s = buildMusicBlock(facts({ playing: false, positionS: 240 }));
    expect(s).toContain('currently paused');
    expect(s).toContain('stopped near the end');
  });

  test('album equal to title (singles) is not repeated; no duration drops the phase', () => {
    const s = buildMusicBlock(facts({ album: '富士山下', durationS: null }));
    expect(s).not.toContain('album');
    expect(s).not.toContain('middle');
  });

  test('trackPhrase survives an artist-less track', () => {
    expect(trackPhrase({ title: 'Rain', artist: '' })).toBe('"Rain"');
  });
});

describe('the artwork firewall', () => {
  test('musicFactsOf carries scalars only — no artwork field exists on the type', () => {
    const f = musicFactsOf(fakeTrack(), true);
    expect(Object.keys(f).sort()).toEqual([
      'album',
      'artist',
      'durationS',
      'playing',
      'positionS',
      'sourceName',
      'title',
    ]);
  });

  test('block text never contains base64 or artwork traces', () => {
    const s = buildMusicBlock(musicFactsOf(fakeTrack(), true));
    expect(s).not.toContain('base64');
    expect(s).not.toContain('cafebabe');
  });
});

describe('musicAmbientEnabled', () => {
  test('provider dormant → false regardless of flag', () => {
    delete Bun.env['LUNA_MUSIC_AMBIENT'];
    expect(musicAmbientEnabled()).toBe(false);
  });

  test('active provider: default on, LUNA_MUSIC_AMBIENT=0 switches off', async () => {
    await activateProvider();
    delete Bun.env['LUNA_MUSIC_AMBIENT'];
    expect(musicAmbientEnabled()).toBe(true);
    Bun.env['LUNA_MUSIC_AMBIENT'] = '0';
    expect(musicAmbientEnabled()).toBe(false);
  });
});

describe('ambient injection into the uncached user tail', () => {
  test('active + playing → exactly one music block in the user message', async () => {
    await activateProvider();
    applyMusicEvent({ event: 'track', track: fakeTrack() }, Date.now());
    const texts = await userTextsOf();
    const music = texts.filter((t) => t.startsWith('Music'));
    expect(music.length).toBe(1);
    expect(music[0]).toContain('富士山下');
  });

  test('active but idle (between players) → zero prompt residue', async () => {
    await activateProvider();
    const texts = await userTextsOf();
    expect(texts.some((t) => t.startsWith('Music'))).toBe(false);
  });

  test('provider dormant → zero residue', async () => {
    const texts = await userTextsOf();
    expect(texts.some((t) => t.startsWith('Music'))).toBe(false);
  });

  test('flag off → tools may exist but the block does not', async () => {
    await activateProvider();
    applyMusicEvent({ event: 'track', track: fakeTrack() }, Date.now());
    Bun.env['LUNA_MUSIC_AMBIENT'] = '0';
    const texts = await userTextsOf();
    expect(texts.some((t) => t.startsWith('Music'))).toBe(false);
  });
});

describe('cache boundary — volatile never enters the cached system block', () => {
  test('buildSystemPrompt is byte-identical across track changes and leaks nothing', async () => {
    Bun.env['LUNA_PERSONA'] = '0';
    Bun.env['LUNA_MEMORY_INJECT'] = '0';
    await activateProvider();
    const session = getSession('test');
    applyMusicEvent({ event: 'track', track: fakeTrack() }, Date.now());
    const a = buildSystemPrompt(session)[0]!.text;
    applyMusicEvent({ event: 'track', track: fakeTrack({ title: '孤勇者', artist: '陈奕迅' }) }, Date.now());
    const b = buildSystemPrompt(session)[0]!.text;
    expect(a).toBe(b);
    expect(a).not.toContain('富士山下');
    expect(a).not.toContain('孤勇者');
  });
});

describe('failure isolation', () => {
  test('musicBlockFor returning null on a torn state never breaks the turn', async () => {
    await activateProvider();
    // stopped event: track null — the block must vanish, the turn must complete
    applyMusicEvent({ event: 'track', track: fakeTrack() }, Date.now());
    applyMusicEvent({ event: 'stopped', at: new Date().toISOString() }, Date.now());
    expect(musicBlockFor()).toBeNull();
    const texts = await userTextsOf();
    expect(texts.some((t) => t === 'hello')).toBe(true);
  });
});
