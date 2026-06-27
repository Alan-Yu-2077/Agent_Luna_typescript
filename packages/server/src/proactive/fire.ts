import type { ServerEvent } from '@luna/protocol';
import type { Provider } from '../provider/types';
import type { ToolRegistry } from '../tools/registry';
import type { DreamLLM } from '../dream/llm';
import type { Session } from '../turn/session';
import { isDreaming } from '../dream/dreamState';
import { runDreamCycle } from '../dream/cycle';
import { runProactiveTurn } from './proactiveTurn';
import { evaluateDetectors, type DetectorCtx, type ProactiveTrigger } from './detectors';
import {
  commitProactive,
  commitProactiveSilent,
  loadCadence,
  markSlotConsumed,
  passesAntiSpam,
  proactiveEnabled,
  saveCadence,
} from './cadence';

// v0.22.2 (Initiative 15): the universal proactive entry point + the REAL single-turn
// lock. Before this, every proactive path (scheduler tick, continuation, dev fire) ran
// its own `session.activeTurn === null` check-then-act — a TOCTOU, not a lock: the two new
// event-hook entry points (ws reconnect, weather refresh) racing on that read could both
// pass and start two concurrent proactive turns. `withProactiveLock` flips a synchronous
// per-session in-flight flag BEFORE any await, so racing callers can't both proceed; the
// whole detector funnel (anti-spam → detectors → debounce → turn → cadence commit) runs
// inside it. {tick, hook, continuation, dev-fire} all acquire the SAME lock.

function num(env: string, fallback: number): number {
  const v = Number(Bun.env[env]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

// The single-turn lock: session ids with a proactive turn acquiring or running.
const inFlight = new Set<string>();

export function proactiveInFlight(sessionId: string): boolean {
  return inFlight.has(sessionId);
}

// The shared rail every proactive path applies: not already in-flight, no reactive turn,
// not dreaming, proactive enabled. Acquires the lock SYNCHRONOUSLY — the has-check and the
// `add` run with no await between them, and `runProactiveTurn` sets `session.activeTurn`
// synchronously before its own first await (runTurn.ts) — so two racing callers can't both
// pass. Runs fn, releases in finally. Returns null without running fn when the rail rejects
// (lock held, a reactive turn live, dreaming, or disabled) — the caller does nothing.
export async function withProactiveLock<T>(
  session: Session,
  fn: () => Promise<T>,
): Promise<T | null> {
  if (inFlight.has(session.id)) return null;
  if (session.activeTurn !== null) return null;
  if (isDreaming()) return null;
  if (!proactiveEnabled()) return null;
  inFlight.add(session.id);
  try {
    return await fn();
  } finally {
    inFlight.delete(session.id);
  }
}

// The detector seam — defaults to the real registry, injectable for tests. Lives here
// (moved from scheduler.ts in v0.22.2) with the funnel that consumes it; the scheduler
// re-exports setProactiveDetectorForTests for back-compat.
let detectProactive: (ctx: DetectorCtx) => ProactiveTrigger | null = evaluateDetectors;
export function setProactiveDetectorForTests(
  fn: ((ctx: DetectorCtx) => ProactiveTrigger | null) | null,
): void {
  detectProactive = fn ?? evaluateDetectors;
}

// Per-detector in-memory debounce — sessionId → debounceKey → lastFiredMs. Complements the
// persistent per-day slot bit (that one is once-per-day): this is a short window that keeps
// an event-driven re-evaluation, or an oscillating condition (weather flapping between
// buckets), from re-firing the SAME trigger key. Resets on restart — worst case one extra
// eval after a restart, still gated by the cadence rail.
const debounce = new Map<string, Map<string, number>>();

function isDebounced(sessionId: string, key: string, nowMs: number): boolean {
  const last = debounce.get(sessionId)?.get(key);
  return last != null && nowMs - last < num('LUNA_PROACTIVE_DEBOUNCE_MS', 4 * 3_600_000);
}

function markDebounced(sessionId: string, key: string, nowMs: number): void {
  let m = debounce.get(sessionId);
  if (!m) {
    m = new Map();
    debounce.set(sessionId, m);
  }
  m.set(key, nowMs);
}

export function resetProactiveFireStateForTests(): void {
  inFlight.clear();
  debounce.clear();
}

export type MaybeFireOpts = {
  session: Session;
  provider: Provider;
  registry: ToolRegistry;
  emit: (e: ServerEvent) => void;
  dreamLlm: DreamLLM;
  nowMs: number;
  nowHour: number;
};

export type FireOutcome = { fired: boolean; spoke: boolean; trigger: ProactiveTrigger | null };

const NO_FIRE: FireOutcome = { fired: false, spoke: false, trigger: null };

// The detector funnel — the one entry point the scheduler tick AND the event hooks call.
// Everything (the anti-spam rail, the detector eval, the debounce, the turn, the cadence
// commit, the dream handoff) runs INSIDE the single-turn lock, so a hook and a tick — or
// two hooks — can't both pass the rail and double-fire. Returns whether a turn fired and
// whether she spoke.
export async function maybeFireProactive(opts: MaybeFireOpts): Promise<FireOutcome> {
  const result = await withProactiveLock(opts.session, async () => {
    const { session, nowMs, nowHour } = opts;
    const cadence = loadCadence(session.id);
    if (!passesAntiSpam(cadence, { lastUserMs: session.lastUserMs, nowMs, nowHour }).ok) {
      return NO_FIRE;
    }
    const trigger = detectProactive({ session, cadence, nowMs, nowHour });
    if (!trigger) return NO_FIRE;
    if (isDebounced(session.id, trigger.debounceKey, nowMs)) return NO_FIRE;

    const { spoke } = await runProactiveTurn({
      session,
      cycleId: `${session.id}:${nowMs}`,
      provider: opts.provider,
      registry: opts.registry,
      emit: opts.emit,
      intent: trigger.intent,
      seed: trigger.seed,
    });

    // Spoke → consume the daily message quota; silent → only stamp the cooldown anchor. A
    // scheduled-slot trigger also marks its per-day bit (fired or silent — the slot is
    // "used" either way). Then debounce the trigger key for the short window.
    let next = spoke ? commitProactive(cadence, nowMs) : commitProactiveSilent(cadence, nowMs);
    if (trigger.debounceKey.startsWith('slot:')) next = markSlotConsumed(next, nowHour, nowMs);
    saveCadence(session.id, next);
    markDebounced(session.id, trigger.debounceKey, nowMs);

    // Dream auto-trigger (LD #11): if she chose to dream during the turn, start the cycle.
    // Fire-and-forget — isDreaming() (set synchronously inside runDreamCycle) gates every
    // subsequent proactive path, so no overlap.
    if (session.pendingDream !== null) {
      session.pendingDream = null;
      void runDreamCycle({ sessionId: session.id, llm: opts.dreamLlm, emit: opts.emit }).catch(
        () => {},
      );
    }

    return { fired: true, spoke, trigger };
  });
  return result ?? NO_FIRE;
}
