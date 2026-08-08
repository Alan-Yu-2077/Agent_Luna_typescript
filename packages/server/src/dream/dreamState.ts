import { getMemoryDb } from '../memory/sessionStore';

export const FINISHED_IDLE = 'finished_idle';

export type DreamStateRow = {
  is_dreaming: number;
  current_step: string | null;
  cycle_id: string | null;
  last_dream_ms: number | null;
  cycle_count: number;
};

// Module state is the synchronous gate read on every chat.send; SQLite is the
// write-through so dreaming state survives restarts (and boot reconciliation
// can detect a crash mid-dream).
let state: DreamStateRow = {
  is_dreaming: 0,
  current_step: null,
  cycle_id: null,
  last_dream_ms: null,
  cycle_count: 0,
};

function writeThrough(): void {
  const db = getMemoryDb();
  if (!db) return;
  db.prepare(
    `UPDATE dream_state SET is_dreaming = ?, current_step = ?, cycle_id = ?, last_dream_ms = ?, cycle_count = ? WHERE id = 1`,
  ).run(state.is_dreaming, state.current_step, state.cycle_id, state.last_dream_ms, state.cycle_count);
}

export function isDreaming(): boolean {
  return state.is_dreaming === 1;
}

export function currentStep(): string | null {
  return state.current_step;
}

export function dreamStatus(): { is_dreaming: boolean; current_step: string | null; last_dream_ms: number | null } {
  return {
    is_dreaming: state.is_dreaming === 1,
    current_step: state.current_step,
    last_dream_ms: state.last_dream_ms,
  };
}

export type EnterResult = { ok: true; cycleId: string } | { ok: false; error: string };

export function enterDream(): EnterResult {
  if (state.is_dreaming === 1) return { ok: false, error: 'already_dreaming' };
  const cycleId = `dream-${state.cycle_count + 1}-${Date.now().toString(36)}`;
  // v0.45.7: stamp on ATTEMPT, not completion. The 6h gate guards LLM budget, and a try has
  // already spent it — before this, aborted dreams never stamped, the stamp froze at the last
  // COMPLETED dream, and every shutdown was perpetually "due" (four dreams in 40 minutes on
  // 8/8, all aborted). parkFinishedIdle's completion stamp stays — a harmless later overwrite.
  state = { ...state, is_dreaming: 1, current_step: null, cycle_id: cycleId, last_dream_ms: Date.now() };
  writeThrough();
  return { ok: true, cycleId };
}

export function setStep(step: string | null): void {
  state = { ...state, current_step: step };
  writeThrough();
}

// Cycle completion parks at finished_idle keeping is_dreaming=true — only an
// explicit wake() resumes chat (Python v0.56.0 semantics).
export function parkFinishedIdle(): void {
  state = { ...state, current_step: FINISHED_IDLE, last_dream_ms: Date.now(), cycle_count: state.cycle_count + 1 };
  writeThrough();
}

export type WakeResult = { ok: true } | { ok: false; error: 'not_dreaming' | 'task_in_progress' };

export function wake(): WakeResult {
  if (state.is_dreaming === 0) return { ok: false, error: 'not_dreaming' };
  if (state.current_step !== FINISHED_IDLE) return { ok: false, error: 'task_in_progress' };
  state = { ...state, is_dreaming: 0, current_step: null, cycle_id: null };
  writeThrough();
  return { ok: true };
}

// Crash mid-dream leaves is_dreaming=1 in SQLite; without this, chat would be
// permanently gated after a restart. Stale cycles are marked aborted and the
// state parks awake.
export function bootReconcile(): void {
  const db = getMemoryDb();
  if (!db) return;
  const row = db
    .prepare('SELECT is_dreaming, current_step, cycle_id, last_dream_ms, cycle_count FROM dream_state WHERE id = 1')
    .get() as DreamStateRow | null;
  if (!row) return;
  if (row.is_dreaming === 1) {
    if (row.cycle_id) {
      db.prepare(
        'UPDATE dream_reports SET ended_ms = ?, report_json = json_patch(report_json, ?) WHERE cycle_id = ? AND ended_ms IS NULL',
      ).run(Date.now(), JSON.stringify({ aborted: true }), row.cycle_id);
    }
    state = { ...row, is_dreaming: 0, current_step: null, cycle_id: null };
    writeThrough();
    console.warn(`[dream] boot reconciliation: stale dreaming state (cycle ${row.cycle_id}) marked aborted`);
    return;
  }
  state = row;
}

export function resetDreamStateForTests(): void {
  state = { is_dreaming: 0, current_step: null, cycle_id: null, last_dream_ms: null, cycle_count: 0 };
}

// v0.32.5 — shutdown-dream cooldown. On desktop every window close SIGTERMs the
// sidecar, so the graceful-exit dream (main.ts) fired on EVERY close — a full
// cycle per app quit, nothing like the once-a-day sleep it was meant to be. Gate
// it: a shutdown dream is only "due" when the last dream is at least `minGapMs`
// old (or there has never been one). Pure so the decision is unit-tested without
// the process-exit handler. minGapMs === 0 restores the old always-dream.
// v0.45.7 (Initiative 33) — the owner's rule: shutdown-triggered dreams belong to the night.
// Local-clock family (the cadence C3 convention): hours via getHours(). Crossing midnight is the
// normal case (21-6). The MANUAL dream.enter path never consults this (D2).
export type DreamWindow = { startHour: number; endHour: number };
export const DEFAULT_DREAM_WINDOW: DreamWindow = { startHour: 21, endHour: 6 };

export function parseDreamWindow(raw: string | undefined, warn?: (m: string) => void): DreamWindow {
  if (raw === undefined || raw.trim() === '') return DEFAULT_DREAM_WINDOW;
  const m = raw.trim().match(/^(\d{1,2})-(\d{1,2})$/);
  const start = m ? Number(m[1]) : NaN;
  const end = m ? Number(m[2]) : NaN;
  if (!m || start > 23 || end > 23 || start === end) {
    warn?.(`[dream] invalid LUNA_SHUTDOWN_DREAM_WINDOW "${raw}" — using default 21-6`);
    return DEFAULT_DREAM_WINDOW;
  }
  return { startHour: start, endHour: end };
}

// [start, end) in local hours; start > end wraps midnight: 21-6 = h >= 21 || h < 6.
export function dreamWindowOpen(nowMs: number, w: DreamWindow = DEFAULT_DREAM_WINDOW): boolean {
  const h = new Date(nowMs).getHours();
  return w.startHour < w.endHour
    ? h >= w.startHour && h < w.endHour
    : h >= w.startHour || h < w.endHour;
}

export function shutdownDreamDue(
  lastDreamMs: number | null,
  nowMs: number,
  minGapMs: number,
): boolean {
  if (lastDreamMs === null) return true; // never consolidated → let the last exit do it
  return nowMs - lastDreamMs >= minGapMs;
}
