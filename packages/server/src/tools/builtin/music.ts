import { z } from 'zod';
import { positionAt, send, type NowPlaying } from '@luna/music-cli';
import { defineTool } from '../defineTool';
import { getNowPlaying, type MusicState } from '../media/nowPlaying';

// Music tools (Initiative 32, v0.45.0) — the read/control pair over the resident now-playing
// provider. Split in two because proactiveRisk is per-tool: reading what's playing is 'safe'
// (a proactive turn may glance silently); controlling HIS playback is deliberately UNMARKED so
// the fail-closed gate (safetyGate.ts) treats it as 'surface' — in a proactive turn she must
// speak first, so "she silently skipped my song" is impossible by construction.

const Snapshot = z.object({
  state: z.enum(['playing', 'paused', 'idle']),
  title: z.string().nullable(),
  artist: z.string().nullable(),
  album: z.string().nullable(),
  position_s: z.number().nullable(),
  duration_s: z.number().nullable(),
  source: z.string().nullable(),
});

const DORMANT_MESSAGE =
  'music observation is not available (LUNA_MUSIC unset, non-macOS, or media-control missing)';

function snapshotOf(s: MusicState): z.infer<typeof Snapshot> {
  const t = s.track;
  if (t === null) {
    return {
      state: 'idle',
      title: null,
      artist: null,
      album: null,
      position_s: null,
      duration_s: null,
      source: null,
    };
  }
  return {
    state: s.playing ? 'playing' : 'paused',
    title: t.title,
    artist: t.artist,
    album: t.album,
    // The stream only snapshots on change; extrapolate so the answer is current without
    // paying a subprocess (the CLI's positionAt contract).
    position_s: Math.round(positionAt(t)),
    duration_s: t.duration === null ? null : Math.round(t.duration),
    source: t.sourceName,
  };
}

function fmtClock(sec: number | null): string {
  if (sec === null) return '?';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function summarizeSnapshot(out: z.infer<typeof Snapshot>): string {
  if (out.state === 'idle') return 'nothing playing';
  const mark = out.state === 'playing' ? '♪' : '⏸';
  return `${mark} ${out.title} — ${out.artist} (${fmtClock(out.position_s)}/${fmtClock(out.duration_s)})`;
}

export const musicNowTool = defineTool({
  name: 'music_now',
  description:
    'What is playing right now (title, artist, album, position). The current track is already in ' +
    'your ambient context — call this only when you need the freshest position or to confirm the ' +
    'result of a control action, not to learn what song is on.',
  input: z.object({}),
  output: Snapshot,
  concurrency: 'safe-parallel',
  proactiveRisk: 'safe',
  timeoutMs: 5000,
  summarize: summarizeSnapshot,
  execute: async function* (_input, _ctx) {
    const s = getNowPlaying();
    if (s === null) {
      yield { kind: 'err', code: 'execution_exception', message: DORMANT_MESSAGE, recoverable: true };
      return;
    }
    yield { kind: 'ok', data: snapshotOf(s) };
  },
});

const ControlInput = z.object({
  op: z.enum(['play', 'pause', 'toggle', 'next', 'prev']),
});

const ControlOutput = Snapshot.extend({ op: z.string() });

export const musicControlTool = defineTool({
  name: 'music_control',
  description:
    'Control his music player: play, pause, toggle, next, prev. Acts on the player he is running ' +
    '(NetEase, Apple Music, …) and returns the state after the command so you can confirm it took.',
  input: ControlInput,
  output: ControlOutput,
  // Mutates one external player; two racing controls would interleave MediaRemote commands.
  concurrency: 'global-serial',
  // NO proactiveRisk on purpose — fail-closed to 'surface': she must speak before touching his
  // playback in a proactive turn. Do not "fix" this by marking it safe.
  timeoutMs: 8000,
  summarize: (out) => `${out.op} → ${summarizeSnapshot(out)}`,
  execute: async function* (input, ctx) {
    const s = getNowPlaying();
    if (s === null) {
      yield { kind: 'err', code: 'execution_exception', message: DORMANT_MESSAGE, recoverable: true };
      return;
    }
    if (ctx.abortSignal.aborted) {
      yield { kind: 'err', code: 'aborted', message: 'music_control aborted', recoverable: true };
      return;
    }
    try {
      // send() confirms by re-reading ~250ms after the command — that fresh snapshot is the
      // truthful answer; the resident provider catches up from the stream on its own.
      const after: NowPlaying | null = await send(input.op);
      const confirmed: MusicState =
        after === null
          ? { track: null, playing: false, changedAtMs: 0 }
          : { track: after, playing: after.playing, changedAtMs: 0 };
      yield { kind: 'ok', data: { ...snapshotOf(confirmed), op: input.op } };
    } catch (e) {
      yield {
        kind: 'err',
        code: ctx.abortSignal.aborted ? 'aborted' : 'execution_exception',
        message: e instanceof Error ? e.message : String(e),
        recoverable: true,
      };
    }
  },
});
