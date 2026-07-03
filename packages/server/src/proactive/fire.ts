import type { ServerEvent } from '@luna/protocol';
import type { Provider } from '../provider/types';
import type { ToolRegistry } from '../tools/registry';
import type { DreamLLM } from '../dream/llm';
import type { Session } from '../turn/session';
import { isDreaming } from '../dream/dreamState';
import { runDreamCycle } from '../dream/cycle';
import { runProactiveTurn } from './proactiveTurn';
import {
  commitLadderPhase,
  commitLadderSilent,
  commitScenario,
  loadCadence,
  passesAntiSpam,
  proactiveEnabled,
  saveCadence,
} from './cadence';
import { evaluateLadder, ladderEnabled } from './ladder';

// v0.22.2 (Initiative 15): the universal proactive entry point + the REAL single-turn lock.
// `withProactiveLock` flips a synchronous per-session in-flight flag BEFORE any await, so racing
// callers (scheduler tick, ws-reconnect hook, weather-refresh hook, continuation, dev-fire) can't
// both proceed. v0.24.1 (Initiative 17): the wake DECISION is now the silence ladder
// (`evaluateLadder`); the detector registry + its per-key debounce + the scheduled-slot machinery
// were deleted. The whole funnel (anti-spam rail → ladder → turn → cadence commit → dream handoff)
// runs inside the lock, so a tick and a hook can never double-fire.

// The single-turn lock: session ids with a proactive turn acquiring or running.
const inFlight = new Set<string>();

export function proactiveInFlight(sessionId: string): boolean {
  return inFlight.has(sessionId);
}

// The shared rail every proactive path applies: not already in-flight, no reactive turn, not
// dreaming, proactive enabled. Acquires the lock SYNCHRONOUSLY — the has-check and the `add` run
// with no await between them, and `runProactiveTurn` sets `session.activeTurn` synchronously before
// its own first await (runTurn.ts) — so two racing callers can't both pass. Runs fn, releases in
// finally. Returns null without running fn when the rail rejects.
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

export function resetProactiveFireStateForTests(): void {
  inFlight.clear();
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

export type FireOutcome = { fired: boolean; spoke: boolean };

const NO_FIRE: FireOutcome = { fired: false, spoke: false };

// The proactive funnel — the one entry point the scheduler tick AND the event hooks call.
// Everything (the anti-spam rail, the ladder decision, the turn, the cadence commit, the dream
// handoff) runs INSIDE the single-turn lock, so a hook and a tick — or two hooks — can't both pass
// the rail and double-fire. `LUNA_PROACTIVE_LADDER=0` is the escape hatch (no proactive openings;
// the reactive path + continuation + dream are unaffected).
export async function maybeFireProactive(opts: MaybeFireOpts): Promise<FireOutcome> {
  const result = await withProactiveLock(opts.session, async () => {
    const { session, nowMs, nowHour } = opts;
    if (!ladderEnabled()) return NO_FIRE;
    const cadence = loadCadence(session.id);
    if (!passesAntiSpam(cadence, { lastActivityMs: session.lastActivityMs, nowMs, nowHour }).ok) {
      return NO_FIRE;
    }

    const decision = evaluateLadder({ session, cadence, nowMs, nowHour });
    if (!decision.scenario) {
      // Nothing fired, but persist the phase transition the evaluator computed (reset /
      // dormant-recovery / engaged→idle_watch / sleeping) so it isn't discarded — WITHOUT stamping
      // lastProactiveMs (no outreach happened), or the recovery/idle clock would re-arm and never
      // elapse. Only write when it actually changed, to avoid a per-tick DB churn.
      if (decision.phase !== cadence.phase || decision.nudgesSent !== cadence.nudgesSent) {
        saveCadence(session.id, commitLadderPhase(cadence, decision.phase, decision.nudgesSent));
      }
      return NO_FIRE;
    }

    const { spoke } = await runProactiveTurn({
      session,
      cycleId: `${session.id}:${nowMs}`,
      provider: opts.provider,
      registry: opts.registry,
      emit: opts.emit,
      scenario: decision.scenario,
    });
    // Spoke → advance the phase from the effective base + consume the daily quota; silent → stamp
    // the cooldown anchor + persist the transition (no quota, no nudge burned — Python note_attempt).
    const next = spoke
      ? commitScenario(cadence, decision.scenario, nowMs, null, {
          phase: decision.phase,
          nudgesSent: decision.nudgesSent,
        })
      : commitLadderSilent(cadence, decision.phase, decision.nudgesSent, nowMs);
    saveCadence(session.id, next);

    // Dream auto-trigger (LD #11): if she chose to dream during the turn, start the cycle.
    // Fire-and-forget — isDreaming() (set synchronously inside runDreamCycle) gates every subsequent
    // proactive path, so no overlap.
    if (session.pendingDream !== null) {
      session.pendingDream = null;
      void runDreamCycle({ sessionId: session.id, llm: opts.dreamLlm, emit: opts.emit }).catch(
        () => {},
      );
    }

    return { fired: true, spoke };
  });
  return result ?? NO_FIRE;
}
