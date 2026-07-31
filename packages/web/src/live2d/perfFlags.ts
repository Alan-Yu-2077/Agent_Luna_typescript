// The performance flags the engine re-reads every tick. They were five string literals duplicated
// between `pixiLive2DSink` (which reads them) and `layout.ts` (which writes them); v0.43.7 adds a
// third writer — the workbench — and a key that only two of the three agree on is a toggle that
// silently does nothing. So the list is the single source of truth, and both readers derive from it.
//
// Semantics, unchanged since v0.42.3: absent means ON. Only the literal '0' turns a flag off, so a
// fresh install gets every proven feature without a migration.

export type PerfFlag = { key: string; label: string; hint: string };

export const GAZE_KEY = 'luna:gaze-follow';
export const AFFECT_KEY = 'luna:affect';
export const LIVE_PEAK_KEY = 'luna:live-peak';
export const SHORT_CLIPS_KEY = 'luna:short-clips';
export const IDLE_ACTIONS_KEY = 'luna:idle-actions';
export const LISTENING_KEY = 'luna:listening';
export const IDLE_PROFILE_KEY = 'luna:idle-profile';

// Labels match the Avatar settings card word for word — the workbench and the shipped panel must
// not name the same switch two different things.
export const PERF_FLAGS: readonly PerfFlag[] = [
  { key: GAZE_KEY, label: 'Gaze follow', hint: 'eyes track the pointer' },
  { key: AFFECT_KEY, label: 'Mood memory', hint: 'the continuous VAD undertone' },
  { key: LIVE_PEAK_KEY, label: 'Living expressions', hint: 'idle leaks through a playing clip' },
  { key: SHORT_CLIPS_KEY, label: 'Brief performances', hint: '~2.5 s clips instead of ~6 s' },
  { key: IDLE_ACTIONS_KEY, label: 'Idle gestures', hint: 'a gesture every 8–20 s when idle' },
  { key: LISTENING_KEY, label: 'Attentive listening', hint: 'turns toward you while you type; thinks visibly' },
];

export function flagOn(key: string, storage?: Pick<Storage, 'getItem'> | null): boolean {
  try {
    const s = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    return s?.getItem(key) !== '0';
  } catch {
    return true; // storage disabled — the feature is on by default, so stay on
  }
}

export function setFlag(key: string, on: boolean, storage?: Pick<Storage, 'setItem'> | null): void {
  try {
    const s = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    s?.setItem(key, on ? '1' : '0');
  } catch {
    /* storage unavailable — the toggle is cosmetic this session */
  }
}
