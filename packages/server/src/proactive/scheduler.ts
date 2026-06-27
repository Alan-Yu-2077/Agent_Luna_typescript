import type { ServerEvent } from '@luna/protocol';
import type { Provider } from '../provider/types';
import type { ToolRegistry } from '../tools/registry';
import type { DreamLLM } from '../dream/llm';
import { activeSessionIds, getSession, type Session } from '../turn/session';
import { listRecentProactiveTexts } from '../memory/sessionStore';
import { isDreaming } from '../dream/dreamState';
import { runDreamCycle } from '../dream/cycle';
import { trace, flushTrace, traceEnabled } from '../trace/instrument';
import { runProactiveTurn, type ProactiveIntent } from './proactiveTurn';
import { buildWakeContext, wakeGate, type WakeVerdict } from './wakeGate';
import { maybeFireProactive, withProactiveLock } from './fire';
import {
  commitProactive,
  commitProactiveSilent,
  loadCadence,
  proactiveEnabled,
  saveCadence,
  shouldConsiderWake,
} from './cadence';

// v0.22.2 (Initiative 15): the detector seam moved to fire.ts (with the funnel that consumes
// it). Re-export so existing callers/tests keep importing it from the scheduler.
export { setProactiveDetectorForTests } from './fire';

// The proactive heartbeat (Initiative 5, v0.10.3) — a single server-side timer
// that, on each tick, runs the wake chain (prefilter → judgment) and fires a
// proactive turn when it says act. This is where the loop becomes AUTONOMOUS.
// Pure backend, no UI-liveness dependency (Python v0.45.0 lesson). Everything
// stays behind LUNA_PROACTIVE; the safety gate + action budget (v0.10.1) and
// the cadence governor (v0.10.2) bound what a fired turn may do.

export type SchedulerDeps = {
  provider: Provider;
  registry: ToolRegistry;
  dreamLlm: DreamLLM;
  emit: (e: ServerEvent) => void;
};

let timer: ReturnType<typeof setInterval> | null = null;

export function startScheduler(deps: SchedulerDeps): void {
  if (timer) return;
  const tickMs = Math.max(5, Number(Bun.env['LUNA_PROACTIVE_TICK_SECONDS'] ?? 60)) * 1000;
  timer = setInterval(() => {
    void runTick(deps).catch(() => {
      /* a tick must never crash the loop */
    });
  }, tickMs);
  // don't keep the process alive just for the heartbeat
  (timer as { unref?: () => void }).unref?.();
}

export function stopScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

function gapLabel(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60_000));
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'}`;
  const hr = Math.round(min / 60);
  return `${hr} hour${hr === 1 ? '' : 's'}`;
}

function daypartOf(hour: number): string {
  if (hour < 6) return 'late night';
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

function emitWakeDecision(session: Session, nowMs: number, verdict: WakeVerdict): void {
  if (!traceEnabled()) return;
  const id = `proactive_wake:${session.id}:${nowMs}`;
  trace({
    schema_v: 1,
    kind: 'decision',
    trace_id: id,
    turn_id: id,
    session_id: session.id,
    t_ms: nowMs,
    surface: 'proactive_wake',
    decision: verdict.act ? 'act' : 'hold',
    reason: verdict.reason,
    evidence: verdict.intent ? { intent: verdict.intent } : {},
  });
  flushTrace(id); // not part of a turn — flush standalone
}

// Serializes ticks: a tick's wakeGate + proactive turn can outlast the tick
// interval; without this, a second timer firing would start a concurrent tick
// that re-passes the (stale, pre-cooldown) prefilter and fires a SECOND
// proactive turn back-to-back, bypassing the cadence governor. One tick at a
// time closes that reentrancy.
let ticking = false;

// One heartbeat tick. Exported so tests drive it directly (no real timer).
export async function runTick(deps: SchedulerDeps): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    await tickOnce(deps);
  } finally {
    ticking = false;
  }
}

async function tickOnce(deps: SchedulerDeps): Promise<void> {
  if (!proactiveEnabled()) return;
  if (isDreaming()) return;
  const now = Date.now();
  const nowHour = new Date(now).getHours();

  // v0.22.0 (Initiative 15): the deterministic detector path is the default; the
  // legacy per-tick LLM wake-gate is a default-off fallback (LUNA_PROACTIVE_LLM_GATE=1)
  // kept for exactly one release, then deleted in v0.22.3.
  const llmGate = Bun.env['LUNA_PROACTIVE_LLM_GATE'] === '1';
  for (const sessionId of activeSessionIds()) {
    const session = getSession(sessionId);
    if (llmGate) {
      await tickLlmGateSession(session, now, nowHour, deps);
    } else {
      // v0.22.2: the whole decision (anti-spam → detectors → debounce → turn → cadence
      // commit) runs inside maybeFireProactive's single-turn lock — the same funnel the
      // event hooks use, so a tick and a hook can never double-fire.
      await maybeFireProactive({
        session,
        provider: deps.provider,
        registry: deps.registry,
        emit: deps.emit,
        dreamLlm: deps.dreamLlm,
        nowMs: now,
        nowHour,
      });
    }
  }
}

// v0.22.2: the weather refresher's event hook — on a notable snapshot change, run one
// detector eval for every active session at the natural instant (not up to a tick late).
// Same funnel + lock as the heartbeat; the weatherShift detector decides notability. A
// no-op under the legacy LLM-gate (hooks are a detector-path feature).
export async function fireProactiveForActiveSessions(deps: SchedulerDeps): Promise<void> {
  if (!proactiveEnabled() || isDreaming()) return;
  if (Bun.env['LUNA_PROACTIVE_LLM_GATE'] === '1') return;
  const now = Date.now();
  const nowHour = new Date(now).getHours();
  for (const sessionId of activeSessionIds()) {
    await maybeFireProactive({
      session: getSession(sessionId),
      provider: deps.provider,
      registry: deps.registry,
      emit: deps.emit,
      dreamLlm: deps.dreamLlm,
      nowMs: now,
      nowHour,
    });
  }
}

// The legacy LLM wake-gate path (LUNA_PROACTIVE_LLM_GATE=1) — a default-off fallback,
// deleted in v0.22.3. Now routes its fire through the shared single-turn lock so it can't
// overlap a hook/continuation either.
async function tickLlmGateSession(
  session: Session,
  now: number,
  nowHour: number,
  deps: SchedulerDeps,
): Promise<void> {
  if (session.activeTurn !== null) return; // short-circuit BEFORE the wakeGate LLM call (parity
  // with the pre-v0.22.2 loop) — don't spend a gate call on a session with a live user turn.
  const cadence = loadCadence(session.id);
  const pf = shouldConsiderWake(cadence, { lastUserMs: session.lastUserMs, nowMs: now, nowHour });
  if (!pf.consider) return;
  const verdict = await wakeGate(
    deps.dreamLlm,
    buildWakeContext({
      gapLabel: gapLabel(now - session.lastUserMs),
      daypart: daypartOf(nowHour),
      recentProactive: listRecentProactiveTexts(session.id, 3),
    }),
  );
  emitWakeDecision(session, now, verdict);
  if (!verdict.act) return;
  const intent: ProactiveIntent = verdict.intent === 'consolidate' ? 'consolidate' : 'spontaneous';
  await withProactiveLock(session, async () => {
    const { spoke } = await runProactiveTurn({
      session,
      cycleId: `${session.id}:${now}`,
      provider: deps.provider,
      registry: deps.registry,
      emit: deps.emit,
      intent,
    });
    saveCadence(session.id, spoke ? commitProactive(cadence, now) : commitProactiveSilent(cadence, now));
    if (session.pendingDream !== null) {
      session.pendingDream = null;
      void runDreamCycle({ sessionId: session.id, llm: deps.dreamLlm, emit: deps.emit }).catch(
        () => {},
      );
    }
  });
}
