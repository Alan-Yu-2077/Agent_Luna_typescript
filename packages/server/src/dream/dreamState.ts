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
  state = { ...state, is_dreaming: 1, current_step: null, cycle_id: cycleId };
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
export function shutdownDreamDue(
  lastDreamMs: number | null,
  nowMs: number,
  minGapMs: number,
): boolean {
  if (lastDreamMs === null) return true; // never consolidated → let the last exit do it
  return nowMs - lastDreamMs >= minGapMs;
}
