import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import type Anthropic from '@anthropic-ai/sdk';
import type { NowPlaying } from '@luna/music-cli';
import { migrate } from '../sql';
import { setMemoryDb } from '../memory/sessionStore';
import { MockProvider } from '../provider/mock';
import type { ProviderEvent } from '../provider/types';
import { messageRegistry } from '../tools/registry';
import { getSession, resetSessions, type Session } from '../turn/session';
import { resetDreamStateForTests } from '../dream/dreamState';
import { loadCadence, saveCadence } from './cadence';
import { maybeFireProactive, resetProactiveFireStateForTests, type MaybeFireOpts } from './fire';
import {
  FRESH_WINDOW_MS,
  commitMusicMoment,
  freshTrackMoment,
  loadMusicMoment,
  musicSeedFor,
  passesMusicGate,
  saveMusicMoment,
} from './musicMoment';
import { applyMusicEvent, startNowPlaying, stopNowPlaying } from '../tools/media/nowPlaying';
import type { MusicState } from '../tools/media/nowPlaying';

// v0.45.2 — the harassment discipline, pinned. The plan's most important test: the global
// cadence rail can NEVER be bypassed by a music moment — a tick the global track vetoes stays
// vetoed, whatever the song did. Then the sub-gates stack on top, phases are respected, rapid
// skips collapse to at most one moment, and the seed carries the track but never artwork.

const ENV = [
  'LUNA_PROACTIVE',
  'LUNA_PROACTIVE_QUIET_HOURS',
  'LUNA_PROACTIVE_LADDER',
  'LUNA_PROACTIVE_MIN_INTERVAL_MS',
  'LUNA_MUSIC_PROACTIVE',
  'LUNA_MUSIC_PROACTIVE_COOLDOWN_MIN',
  'LUNA_MUSIC_PROACTIVE_DAILY',
  'LUNA_PROACTIVE_AMBIENT_MIN_MS',
];
const saved: Record<string, string | undefined> = {};

const endRound: ProviderEvent = {
  kind: 'message_stop',
  stopReason: 'end_turn',
  toolUses: [],
  assistantContent: [] as unknown as Anthropic.ContentBlock[],
  usage: { input_tokens: 5, output_tokens: 1 },
};

const dreamLlm = { primary: new MockProvider([]), fallback: null };

let db: Database;
beforeEach(() => {
  for (const k of ENV) saved[k] = Bun.env[k];
  db = new Database(':memory:', { strict: true });
  migrate(db, join(import.meta.dir, '..', 'migrations'));
  setMemoryDb(db);
  Bun.env['LUNA_PROACTIVE'] = '1';
  Bun.env['LUNA_PROACTIVE_QUIET_HOURS'] = ''; // clock-independent by default
  resetSessions();
  resetDreamStateForTests();
  resetProactiveFireStateForTests();
});
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete Bun.env[k];
    else Bun.env[k] = saved[k];
  }
  stopNowPlaying();
  setMemoryDb(null);
  resetProactiveFireStateForTests();
  db.close(false);
});

function fakeTrack(over: Partial<NowPlaying> = {}): NowPlaying {
  return {
    id: 'trk1',
    sessionId: null,
    title: '稻香',
    artist: '周杰伦',
    album: '魔杰座',
    duration: 223,
    position: 5,
    playing: true,
    playbackRate: 1,
    source: 'com.netease.163music',
    sourceName: 'netease',
    artworkHash: 'feedface',
    artworkPath: null,
    liked: null,
    shuffle: null,
    repeat: null,
    sampledAt: new Date().toISOString(),
    ...over,
  };
}

function musicState(over: Partial<MusicState> = {}): MusicState {
  return { track: fakeTrack(), playing: true, changedAtMs: 1000, ...over };
}

async function activateProviderWithTrack(nowMs: number): Promise<void> {
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
  applyMusicEvent({ event: 'track', track: fakeTrack() }, nowMs - 30_000); // 30s ago: fresh
}

// Quiet for 6 minutes: past the 60s idle floor, under the 10m idle threshold, and past the 5m
// ambient minimum — but ambientProb rng makes ambient nondeterministic, so tests that need a
// clean "ladder decides nothing" tick raise LUNA_PROACTIVE_AMBIENT_MIN_MS instead.
function quietFor(s: Session, nowMs: number, ms: number): void {
  s.lastUserMs = nowMs - ms;
  s.lastActivityMs = nowMs - ms;
}

function opts(
  session: Session,
  provider: MockProvider,
  nowMs: number,
): MaybeFireOpts & { provider: MockProvider } {
  return {
    session,
    provider,
    registry: messageRegistry,
    emit: () => {},
    dreamLlm,
    nowMs,
    nowHour: new Date(nowMs).getHours(),
  };
}

// Two ROUNDS: the tool_use stop (she calls message), then the end after dispatch.
function speakRounds(text: string): ProviderEvent[][] {
  const toolUses = [{ id: 'tu1', name: 'message', input: { text, is_final: true } }];
  return [
    [
      {
        kind: 'message_stop',
        stopReason: 'tool_use',
        toolUses,
        assistantContent: toolUses.map((t) => ({
          type: 'tool_use',
          id: t.id,
          name: t.name,
          input: t.input,
        })) as unknown as Anthropic.ContentBlock[],
        usage: { input_tokens: 5, output_tokens: 2 },
      },
    ],
    [endRound],
  ];
}

// A tick where the ladder itself stays quiet (engaged phase, gap below ambient minimum).
function setupQuietTick(nowMs: number): Session {
  Bun.env['LUNA_PROACTIVE_AMBIENT_MIN_MS'] = String(60 * 60_000); // ambient unreachable
  const s = getSession('default');
  quietFor(s, nowMs, 2 * 60_000); // 2min — past the idle floor, under everything else
  return s;
}

describe('freshTrackMoment (pure)', () => {
  test('inside the window and playing → the track', () => {
    expect(freshTrackMoment(musicState({ changedAtMs: 1000 }), 1000 + 60_000)?.title).toBe('稻香');
  });
  test('expired window → null (no backlog firing)', () => {
    expect(freshTrackMoment(musicState({ changedAtMs: 1000 }), 1000 + FRESH_WINDOW_MS + 1)).toBeNull();
  });
  test('paused → null; dormant/idle → null; never-changed → null', () => {
    expect(freshTrackMoment(musicState({ playing: false }), 2000)).toBeNull();
    expect(freshTrackMoment(null, 2000)).toBeNull();
    expect(freshTrackMoment(musicState({ track: null }), 2000)).toBeNull();
    expect(freshTrackMoment(musicState({ changedAtMs: 0 }), 2000)).toBeNull();
  });
});

describe('the sub-gate (pure)', () => {
  test('cooldown then quota, local-day rollover', () => {
    const now = Date.now();
    expect(passesMusicGate({ lastFireMs: 0, quotaUsed: 0, quotaDate: '' }, now).ok).toBe(true);
    expect(passesMusicGate({ lastFireMs: now - 10 * 60_000, quotaUsed: 0, quotaDate: '' }, now)).toMatchObject({
      ok: false,
      reason: 'music_cooldown',
    });
    const today = new Date(now);
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    expect(
      passesMusicGate({ lastFireMs: now - 60 * 60_000, quotaUsed: 3, quotaDate: key }, now),
    ).toMatchObject({ ok: false, reason: 'music_quota_exhausted' });
    // yesterday's exhausted quota does not count today
    expect(
      passesMusicGate({ lastFireMs: now - 60 * 60_000, quotaUsed: 3, quotaDate: '2000-01-01' }, now).ok,
    ).toBe(true);
  });

  test('commit stamps cooldown always, quota only when spoke', () => {
    const now = Date.now();
    const silent = commitMusicMoment({ lastFireMs: 0, quotaUsed: 0, quotaDate: '' }, now, false);
    expect(silent.lastFireMs).toBe(now);
    expect(silent.quotaUsed).toBe(0);
    const spoke = commitMusicMoment({ lastFireMs: 0, quotaUsed: 0, quotaDate: '' }, now, true);
    expect(spoke.quotaUsed).toBe(1);
  });
});

describe('the seed', () => {
  test('carries the track phrase, never artwork', () => {
    const seed = musicSeedFor(fakeTrack());
    expect(seed).toContain('"稻香" by 周杰伦');
    expect(seed).toContain('魔杰座');
    expect(seed).not.toContain('feedface');
    expect(seed).not.toContain('base64');
  });
});

describe('THE test: the global rail cannot be bypassed', () => {
  test('global cooldown vetoes the tick — a fresh moment changes nothing', async () => {
    const nowMs = Date.now();
    const s = setupQuietTick(nowMs);
    await activateProviderWithTrack(nowMs);
    // global cooldown: a proactive fired 1s ago
    saveCadence(s.id, { ...loadCadence(s.id), lastProactiveMs: nowMs - 1000 });
    const provider = new MockProvider([]);
    const r = await maybeFireProactive(opts(s, provider, nowMs));
    expect(r.fired).toBe(false);
    expect(provider.requests.length).toBe(0);
  });

  test('global quota exhausted vetoes the tick', async () => {
    const nowMs = Date.now();
    const s = setupQuietTick(nowMs);
    await activateProviderWithTrack(nowMs);
    const today = new Date(nowMs);
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    saveCadence(s.id, { ...loadCadence(s.id), quotaUsed: 99, quotaDate: key });
    const provider = new MockProvider([]);
    const r = await maybeFireProactive(opts(s, provider, nowMs));
    expect(r.fired).toBe(false);
    expect(provider.requests.length).toBe(0);
  });

  test('quiet hours veto the tick', async () => {
    const nowMs = Date.now();
    const s = setupQuietTick(nowMs);
    await activateProviderWithTrack(nowMs);
    Bun.env['LUNA_PROACTIVE_QUIET_HOURS'] = String(new Date(nowMs).getHours());
    const provider = new MockProvider([]);
    const r = await maybeFireProactive(opts(s, provider, nowMs));
    expect(r.fired).toBe(false);
    expect(provider.requests.length).toBe(0);
  });
});

describe('phases are respected', () => {
  for (const phase of ['dormant', 'sleeping', 'nudged'] as const) {
    test(`${phase} + a valid moment → no fire`, async () => {
      const nowMs = Date.now();
      const s = setupQuietTick(nowMs);
      await activateProviderWithTrack(nowMs);
      // Global rail must PASS (that veto is the previous suite) while the phase itself blocks:
      // interval floor is 120s, so a 3-minute-old outreach clears a 2-minute global cooldown but
      // stays inside nudged's 5-minute renudge backoff (the ladder stays quiet, not firing).
      Bun.env['LUNA_PROACTIVE_MIN_INTERVAL_MS'] = String(2 * 60_000);
      saveCadence(s.id, {
        ...loadCadence(s.id),
        phase,
        nudgesSent: phase === 'nudged' ? 1 : 0,
        lastProactiveMs: nowMs - 3 * 60_000,
      });
      // the user has NOT spoken since her outreach — no reset
      quietFor(s, nowMs, 5 * 60_000);
      s.lastUserMs = nowMs - 60 * 60_000;
      const provider = new MockProvider([]);
      const r = await maybeFireProactive(opts(s, provider, nowMs));
      expect(r.fired).toBe(false);
      expect(provider.requests.length).toBe(0);
    });
  }
});

describe('the fire path', () => {
  test('quiet ladder tick + fresh moment → fires with the seed; consumes BOTH accounts', async () => {
    const nowMs = Date.now();
    const s = setupQuietTick(nowMs);
    await activateProviderWithTrack(nowMs);
    const provider = new MockProvider(speakRounds('这首我也喜欢。'));
    const r = await maybeFireProactive(opts(s, provider, nowMs));
    expect(r.fired).toBe(true);
    expect(r.spoke).toBe(true);
    // the seed rode the framing
    const sent = JSON.stringify(provider.requests[0]?.messages ?? []);
    expect(sent).toContain('稻香');
    // global account consumed — no exemption
    const cad = loadCadence(s.id);
    expect(cad.quotaUsed).toBe(1);
    expect(cad.lastProactiveMs).toBe(nowMs);
    // music account consumed
    const m = loadMusicMoment(s.id);
    expect(m.quotaUsed).toBe(1);
    expect(m.lastFireMs).toBe(nowMs);
  });

  test('music sub-cooldown blocks a second moment even when the global rail passes', async () => {
    const nowMs = Date.now();
    const s = setupQuietTick(nowMs);
    await activateProviderWithTrack(nowMs);
    Bun.env['LUNA_PROACTIVE_MIN_INTERVAL_MS'] = String(2 * 60_000); // global cooldown: floor (2min)
    saveCadence(s.id, { ...loadCadence(s.id), lastProactiveMs: nowMs - 5 * 60_000 });
    saveMusicMoment(s.id, { lastFireMs: nowMs - 10 * 60_000, quotaUsed: 1, quotaDate: '' });
    const provider = new MockProvider([]);
    const r = await maybeFireProactive(opts(s, provider, nowMs));
    expect(r.fired).toBe(false);
    expect(provider.requests.length).toBe(0);
  });

  test('music daily quota exhausts independently; next day it recovers', async () => {
    const nowMs = Date.now();
    const s = setupQuietTick(nowMs);
    await activateProviderWithTrack(nowMs);
    const today = new Date(nowMs);
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    saveMusicMoment(s.id, { lastFireMs: nowMs - 2 * 60 * 60_000, quotaUsed: 3, quotaDate: key });
    const provider = new MockProvider([]);
    expect((await maybeFireProactive(opts(s, provider, nowMs))).fired).toBe(false);
    // "next day": same state, dated yesterday
    resetProactiveFireStateForTests();
    saveMusicMoment(s.id, { lastFireMs: nowMs - 2 * 60 * 60_000, quotaUsed: 3, quotaDate: '2000-01-01' });
    const provider2 = new MockProvider(speakRounds('新的一天。'));
    expect((await maybeFireProactive(opts(s, provider2, nowMs))).fired).toBe(true);
  });

  test('LUNA_MUSIC_PROACTIVE=0 → the whole path is dead while ambient stays untouched', async () => {
    const nowMs = Date.now();
    const s = setupQuietTick(nowMs);
    await activateProviderWithTrack(nowMs);
    Bun.env['LUNA_MUSIC_PROACTIVE'] = '0';
    const provider = new MockProvider([]);
    const r = await maybeFireProactive(opts(s, provider, nowMs));
    expect(r.fired).toBe(false);
    expect(provider.requests.length).toBe(0);
  });

  test('rapid skip-skip-skip inside the window → at most one fire', async () => {
    const nowMs = Date.now();
    const s = setupQuietTick(nowMs);
    await activateProviderWithTrack(nowMs);
    applyMusicEvent({ event: 'track', track: fakeTrack({ id: 'b', title: '七里香' }) }, nowMs - 20_000);
    applyMusicEvent({ event: 'track', track: fakeTrack({ id: 'c', title: '晴天' }) }, nowMs - 10_000);
    const provider = new MockProvider(speakRounds('换到这首了呀。'));
    const r1 = await maybeFireProactive(opts(s, provider, nowMs));
    expect(r1.fired).toBe(true);
    // only the LAST track was the moment
    expect(JSON.stringify(provider.requests[0]?.messages ?? [])).toContain('晴天');
    // the very next tick: sub-cooldown holds — no second fire off the same burst
    resetProactiveFireStateForTests();
    quietFor(s, nowMs + 60_000, 2 * 60_000);
    const provider2 = new MockProvider([]);
    const r2 = await maybeFireProactive(opts(s, provider2, nowMs + 60_000));
    expect(r2.fired).toBe(false);
    expect(provider2.requests.length).toBe(0);
  });
});
