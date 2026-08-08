import type { NowPlaying } from '@luna/music-cli';
import { getMemoryDb } from '../memory/sessionStore';
import { getNowPlaying, type MusicState } from '../tools/media/nowPlaying';
import { trackPhrase } from '../turn/nowPlayingContext';
import { dateKey } from './cadence';

// Initiative 32 (v0.45.2) — the track-change moment. The architecture red line (M6): the
// detector registry died in v0.24.1 and the tick decision flow is the ONLY proactive wake path,
// so this module is not a trigger — it is a new wake REASON evaluated inside the existing tick,
// strictly AFTER the global cadence rail and the ladder have had their say. A song changing
// every three minutes is a firehose; the discipline here (fresh window, sub-cooldown, sub-quota)
// is what keeps "she's listening with him" from becoming a bullet screen.

// Fresh window: ≥2× the 60s scheduler tick so every change is evaluated 1–2 times, then the
// moment EXPIRES — a stale change never queues up behind a cooldown and fires late.
export const FRESH_WINDOW_MS = 120_000;

// A moment exists iff the CURRENT track started within the window and is still playing. The
// provider state carries only the current identity, so "did he change again" needs no history:
// rapid skip-skip-skip leaves only the last track's changedAtMs inside the window — natural
// debounce, at most one moment survives.
export function freshTrackMoment(s: MusicState | null, nowMs: number): NowPlaying | null {
  if (!s || s.track === null || !s.playing) return null;
  if (s.changedAtMs <= 0 || nowMs - s.changedAtMs > FRESH_WINDOW_MS) return null;
  return s.track;
}

// Default on riding LUNA_MUSIC (a dormant provider means no moments at all);
// LUNA_MUSIC_PROACTIVE=0 switches only this surface off — ambient context is untouched.
export function musicProactiveEnabled(): boolean {
  return Bun.env['LUNA_MUSIC_PROACTIVE'] !== '0' && getNowPlaying() !== null;
}

// The sub-gate state, shaped like Cadence: a cooldown anchor + a locally-dated daily quota.
export type MusicMomentState = {
  lastFireMs: number; // 0 = never
  quotaUsed: number;
  quotaDate: string; // local YYYY-MM-DD, same clock as the cadence quota (dateKey)
};

const DEFAULT_STATE: MusicMomentState = { lastFireMs: 0, quotaUsed: 0, quotaDate: '' };

function num(env: string, fallback: number): number {
  const v = Number(Bun.env[env]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

export function musicCooldownMs(): number {
  return num('LUNA_MUSIC_PROACTIVE_COOLDOWN_MIN', 45) * 60_000;
}

export function musicDailyQuota(): number {
  return num('LUNA_MUSIC_PROACTIVE_DAILY', 3);
}

// The second gate, applied only after the global rail said yes. Conservative by default:
// 45 minutes between song comments, three a day — a companion remarks occasionally; a ticker
// annotates every track.
export function passesMusicGate(
  m: MusicMomentState,
  nowMs: number,
): { ok: boolean; reason: string } {
  const since = m.lastFireMs > 0 ? nowMs - m.lastFireMs : Infinity;
  if (since < musicCooldownMs()) return { ok: false, reason: 'music_cooldown' };
  if (m.quotaDate === dateKey(nowMs) && m.quotaUsed >= musicDailyQuota()) {
    return { ok: false, reason: 'music_quota_exhausted' };
  }
  return { ok: true, reason: 'ok' };
}

// Mirror of the cadence commit split: the cooldown anchor stamps on every music-initiated turn
// (a consideration happened), the quota counts only MESSAGES (spoke).
export function commitMusicMoment(
  m: MusicMomentState,
  nowMs: number,
  spoke: boolean,
): MusicMomentState {
  if (!spoke) return { ...m, lastFireMs: nowMs };
  const today = dateKey(nowMs);
  return {
    lastFireMs: nowMs,
    quotaUsed: m.quotaDate === today ? m.quotaUsed + 1 : 1,
    quotaDate: today,
  };
}

// The seed the proactive framing appends (the v0.22.0 seed channel — README OQ3 resolved to the
// lighter option: no fourth intent). Scalars from trackPhrase only; artwork cannot appear here.
export function musicSeedFor(track: NowPlaying): string {
  const album = track.album && track.album !== track.title ? ` (album "${track.album}")` : '';
  return (
    `(He just put on ${trackPhrase(track)}${album} — you are hearing it too. If a natural ` +
    'half-sentence about it surfaces — a feeling, a memory, what this song is to either of you — ' +
    'you may hand it over, light as a passing musing; it needs no reply. If nothing genuine ' +
    'comes, stay quiet.)'
  );
}

type Row = {
  music_last_fire_ms: number;
  music_quota_used: number;
  music_quota_date: string;
};

export function loadMusicMoment(sessionId: string): MusicMomentState {
  const db = getMemoryDb();
  if (!db) return { ...DEFAULT_STATE };
  const row = db
    .prepare('SELECT music_last_fire_ms, music_quota_used, music_quota_date FROM sessions WHERE id = ?')
    .get(sessionId) as Row | null;
  if (!row) return { ...DEFAULT_STATE };
  return {
    lastFireMs: row.music_last_fire_ms,
    quotaUsed: row.music_quota_used,
    quotaDate: row.music_quota_date,
  };
}

export function saveMusicMoment(sessionId: string, m: MusicMomentState): void {
  const db = getMemoryDb();
  if (!db) return;
  const changes = db
    .prepare('UPDATE sessions SET music_last_fire_ms=?, music_quota_used=?, music_quota_date=? WHERE id=?')
    .run(m.lastFireMs, m.quotaUsed, m.quotaDate, sessionId).changes;
  if (changes === 0) {
    db.prepare(
      'INSERT INTO sessions (id, updated_ms, music_last_fire_ms, music_quota_used, music_quota_date) VALUES (?,?,?,?,?)',
    ).run(sessionId, Date.now(), m.lastFireMs, m.quotaUsed, m.quotaDate);
  }
}
