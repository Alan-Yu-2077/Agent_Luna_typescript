import type { ServerEvent } from '@luna/protocol';
import type { Provider } from '../provider/types';
import type { ToolRegistry } from '../tools/registry';
import type { DreamLLM } from '../dream/llm';
import { activeSessionIds, getSession } from '../turn/session';
import { isDreaming } from '../dream/dreamState';
import { maybeFireProactive } from './fire';
import { proactiveEnabled } from './cadence';

// The proactive heartbeat (Initiative 5, v0.10.3) — a single server-side timer that, on each
// tick, runs the proactive funnel per session and fires a proactive turn when the wake decision
// says so. This is where the loop becomes AUTONOMOUS. Pure backend, no UI-liveness dependency
// (Python v0.45.0 lesson). Everything stays behind LUNA_PROACTIVE; the cadence governor (v0.10.2)
// + the single-turn lock (v0.22.2) bound what fires. v0.24.1 (Initiative 17) made the silence
// ladder the wake decision (the detector registry was deleted); there is no speculative LLM call
// on the heartbeat.

export type SchedulerDeps = {
  provider: Provider;
  registry: ToolRegistry;
  dreamLlm: DreamLLM; // only for the dream-cycle handoff inside a fired turn, not the tick decision
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

// Serializes ticks: a tick's proactive turn can outlast the tick interval; without this a
// second timer firing would start a concurrent tick. (The per-session single-turn lock in
// fire.ts is the real correctness guard now — this just avoids redundant tick work.)
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
    // The whole decision (anti-spam → detectors → debounce → turn → cadence commit) runs
    // inside maybeFireProactive's single-turn lock — the same funnel the event hooks use, so
    // a tick and a hook can never double-fire.
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

// v0.22.2: the weather refresher's event hook — on a notable snapshot change, run one detector
// eval for every active session at the natural instant (not up to a tick late). Same funnel +
// lock as the heartbeat; the weatherShift detector decides notability.
export async function fireProactiveForActiveSessions(deps: SchedulerDeps): Promise<void> {
  if (!proactiveEnabled() || isDreaming()) return;
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
