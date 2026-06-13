import type { ServerEvent } from '@luna/protocol';
import type { Provider } from '../provider/types';
import type { ToolRegistry } from '../tools/registry';
import type { DreamLLM } from '../dream/llm';
import { activeSessionIds, getSession, type Session } from '../turn/session';
import { isDreaming } from '../dream/dreamState';
import { trace, flushTrace, traceEnabled } from '../trace/instrument';
import { runProactiveTurn } from './proactiveTurn';
import { buildWakeContext, wakeGate, type WakeVerdict } from './wakeGate';
import {
  commitProactive,
  loadCadence,
  proactiveEnabled,
  saveCadence,
  shouldConsiderWake,
} from './cadence';

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

  for (const sessionId of activeSessionIds()) {
    const session = getSession(sessionId);
    if (session.activeTurn !== null) continue; // never overlap a user turn

    const cadence = loadCadence(sessionId);
    const pf = shouldConsiderWake(cadence, { lastUserMs: session.lastUserMs, nowMs: now, nowHour });
    if (!pf.consider) continue;

    const verdict = await wakeGate(
      deps.dreamLlm,
      buildWakeContext({
        gapLabel: gapLabel(now - session.lastUserMs),
        daypart: daypartOf(nowHour),
        recentProactive: [],
      }),
    );
    emitWakeDecision(session, now, verdict);
    if (!verdict.act) continue;

    // TOCTOU re-check: the wakeGate LLM call took real time; a user turn or a
    // dream may have started, or the kill switch flipped. runProactiveTurn sets
    // activeTurn synchronously before its first await, so once this passes there
    // is no interleaving window with chat.send.
    if (session.activeTurn !== null || isDreaming() || !proactiveEnabled()) continue;

    await runProactiveTurn({
      session,
      cycleId: `${sessionId}:${now}`,
      provider: deps.provider,
      registry: deps.registry,
      emit: deps.emit,
    });
    saveCadence(sessionId, commitProactive(cadence, now));
  }
}
