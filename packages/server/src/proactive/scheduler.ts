import type { ServerEvent } from '@luna/protocol';
import type { Provider } from '../provider/types';
import type { ToolRegistry } from '../tools/registry';
import type { DreamLLM } from '../dream/llm';
import { activeSessionIds, getSession, type Session } from '../turn/session';
import { listRecentProactiveTexts } from '../memory/sessionStore';
import { isDreaming } from '../dream/dreamState';
import { runDreamCycle } from '../dream/cycle';
import { trace, flushTrace, traceEnabled } from '../trace/instrument';
import { runProactiveTurn, lastInteractionMs, type ProactiveIntent } from './proactiveTurn';
import { buildWakeContext, wakeGate, type WakeVerdict } from './wakeGate';
import { afterANightOpening } from '../turn/temporalContext';
import {
  commitProactive,
  commitProactiveSilent,
  loadCadence,
  passesAntiSpam,
  proactiveEnabled,
  saveCadence,
  shouldConsiderWake,
} from './cadence';

// v0.22.0 (Initiative 15): the after-a-night detector's seed — a concrete reason
// appended to the proactive turn's framing so she drafts from "it's the first I'm
// seeing him after a night" instead of the old gate hunting for a reason in the
// abstract (and always finding none).
const AFTER_NIGHT_SEED =
  '(Context: this is the first time you are seeing Alan again after a night — or a longer ' +
  'absence. A warm, natural hello, or quietly picking up a real thread from before, would fit ' +
  'here — only if you genuinely have something to bring; never a status or check-in question, ' +
  'and staying silent is completely fine.)';

// v0.22.0: the detector seam — `null` = no trigger, else the trigger's seed. Today
// it's just the after-a-night opener; v0.22.1 grows it into the detector registry.
// Injectable so the scheduler is testable without the real morning/clock dependency
// inside `afterANightOpening` (mirrors the `setWeatherFetcher` seam pattern).
export type ProactiveTrigger = { seed: string };
const defaultDetector = (session: Session, nowMs: number): ProactiveTrigger | null =>
  afterANightOpening(nowMs, lastInteractionMs(session)) ? { seed: AFTER_NIGHT_SEED } : null;
let detectProactive = defaultDetector;
export function setProactiveDetectorForTests(
  fn: ((session: Session, nowMs: number) => ProactiveTrigger | null) | null,
): void {
  detectProactive = fn ?? defaultDetector;
}

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
    if (session.activeTurn !== null) continue; // never overlap a user turn

    const cadence = loadCadence(sessionId);
    const wakeCtx = { lastUserMs: session.lastUserMs, nowMs: now, nowHour };
    let intent: ProactiveIntent = 'spontaneous';
    let seed = '';

    if (llmGate) {
      const pf = shouldConsiderWake(cadence, wakeCtx);
      if (!pf.consider) continue;
      const verdict = await wakeGate(
        deps.dreamLlm,
        buildWakeContext({
          gapLabel: gapLabel(now - session.lastUserMs),
          daypart: daypartOf(nowHour),
          recentProactive: listRecentProactiveTexts(sessionId, 3),
        }),
      );
      emitWakeDecision(session, now, verdict);
      if (!verdict.act) continue;
      intent = verdict.intent === 'consolidate' ? 'consolidate' : 'spontaneous';
    } else {
      // Anti-spam SUBSET only (quiet hours + cooldown + quota — NOT deep_absence,
      // NOT the 10m too_soon floor, so a >18h overnight/weekend gap still fires),
      // then the deterministic detector. The turn itself decides whether to speak.
      if (!passesAntiSpam(cadence, wakeCtx).ok) continue;
      const trigger = detectProactive(session, now);
      if (!trigger) continue;
      seed = trigger.seed;
    }

    // TOCTOU re-check: any await above (wakeGate, or none on the detector path) took
    // real time; a user turn or a dream may have started, or the kill switch flipped.
    // runProactiveTurn sets activeTurn synchronously before its first await, so once
    // this passes there is no interleaving window with chat.send.
    if (session.activeTurn !== null || isDreaming() || !proactiveEnabled()) continue;

    const { spoke } = await runProactiveTurn({
      session,
      cycleId: `${sessionId}:${now}`,
      provider: deps.provider,
      registry: deps.registry,
      emit: deps.emit,
      intent,
      seed,
    });
    // v0.22.0: only a turn that actually spoke consumes the daily message quota; a
    // silent consideration just stamps the cooldown (so it can't re-fire next tick).
    saveCadence(sessionId, spoke ? commitProactive(cadence, now) : commitProactiveSilent(cadence, now));

    // Dream auto-trigger (v0.11.0, closes LD #11's deferred half): if she chose
    // to dream during the proactive turn, start the cycle. Fire-and-forget —
    // isDreaming() gates every subsequent tick, so no overlap.
    if (session.pendingDream !== null) {
      session.pendingDream = null;
      void runDreamCycle({ sessionId, llm: deps.dreamLlm, emit: deps.emit }).catch(() => {});
    }
  }
}
