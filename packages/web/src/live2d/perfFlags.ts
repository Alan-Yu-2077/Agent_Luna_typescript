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
export const SPEECH_PERF_KEY = 'luna:speech-performance';
export const IDLE_PROFILE_KEY = 'luna:idle-profile';

// Labels match the Avatar settings card word for word — the workbench and the shipped panel must
// not name the same switch two different things.
export const PERF_FLAGS: readonly PerfFlag[] = [
  { key: GAZE_KEY, label: '视线跟随', hint: '眼睛跟着指针移动' },
  { key: AFFECT_KEY, label: '情绪记忆', hint: '持续保留一层情绪底色' },
  { key: LIVE_PEAK_KEY, label: '灵动表情', hint: '表演动作中仍保留待机细节' },
  { key: SHORT_CLIPS_KEY, label: '短时表现', hint: '约 2.5 秒，而不是约 6 秒的动作片段' },
  { key: IDLE_ACTIONS_KEY, label: '待机动作', hint: '待机时每 8–20 秒做一次小动作' },
  { key: LISTENING_KEY, label: '专注倾听', hint: '你输入时她会转向你，并表现出思考' },
  { key: SPEECH_PERF_KEY, label: '说话表现', hint: '会在说话重音处点头' },
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
