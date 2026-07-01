import type { Session } from '../turn/session';
import type { Cadence, ProactivePhase } from './cadence';
import { effectiveCadence } from './style';

// v0.24.0 (Initiative 17): the silence-driven escalation ladder — Alan's original
// Python proactive design (`runtime/proactive.py` evaluate()) restored as the proactive
// DECISION layer. Pure + clock/rng-injectable. Behind `LUNA_PROACTIVE_LADDER`; when on,
// `maybeFireProactive` consults this instead of the detector registry (which v0.24.1 deletes).
//
// One signal drives everything: effective_gap = how long since ANYONE last spoke in the
// channel — the user OR Luna's own last outreach — so she never nudges into a silence she
// just broke. The phase machine climbs a restraint ladder:
//   engaged → (quiet a while) idle_nudge → (no reply) renudge×N on exponential backoff →
//   leave_message → dormant → (auto-recover after a cool-down of genuine silence) engaged.
// The anti-spam rail (cadence.passesAntiSpam) already enforced quiet-hours + the idle floor +
// the base cooldown + the daily quota before we get here, so the ladder layers ONLY the phase
// logic on top — it does not re-gate the base cooldown (the renudge backoff is a longer,
// separate spacing).

export type ProactiveScenario = 'ambient' | 'idle_nudge' | 'renudge' | 'leave_message';

export type LadderCtx = {
  session: Session;
  cadence: Cadence;
  nowMs: number;
  nowHour: number;
};

function num(env: string, fallback: number): number {
  const v = Number(Bun.env[env]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

// v0.24.1 (Initiative 17): default ON — the ladder is now THE proactive wake decision (the detector
// registry was deleted). `LUNA_PROACTIVE_LADDER=0` is the escape hatch (no proactive openings).
export function ladderEnabled(): boolean {
  return Bun.env['LUNA_PROACTIVE_LADDER'] !== '0';
}

// proactive.py:56 RENUDGE_BACKOFF — each successive re-nudge waits longer, so she backs off
// rather than piling on.
const RENUDGE_BACKOFF = [1.0, 2.4, 6.0] as const;
function renudgeGapMs(nudgesSent: number, baseMs: number): number {
  const idx = Math.min(Math.max(nudgesSent - 1, 0), RENUDGE_BACKOFF.length - 1);
  return baseMs * RENUDGE_BACKOFF[idx]!;
}

// A tick's decision: the scenario to fire (or null to stay quiet this tick) PLUS the effective
// phase/nudgesSent the machine computed — after the user-reset, dormant-recovery, and
// engaged→idle_watch transitions. Python mutates a shared `st` dict IN PLACE so those transitions
// persist across BOTH spoke and silent ticks (proactive.py:255,291,301 + note_attempt:344-347); the
// TS ladder is pure, so it RETURNS the transition and the caller (fire.ts) persists it on every path.
// Discarding it on a silent tick would drop a dormant→engaged recovery and lock her in dormant forever.
export type LadderDecision = {
  scenario: ProactiveScenario | null;
  phase: ProactivePhase;
  nudgesSent: number;
};

export function evaluateLadder(ctx: LadderCtx, rng: () => number = Math.random): LadderDecision {
  const { session, cadence, nowMs } = ctx;

  const idleThresholdMs = num('LUNA_PROACTIVE_IDLE_THRESHOLD_MS', 600_000); // 10m — deliberately > ambientMin so ambient is reachable
  const ambientMinMs = num('LUNA_PROACTIVE_AMBIENT_MIN_MS', 120_000); // 2m
  // v0.24.2: the probabilities + renudge spacing come from the effective cadence (activeness lever
  // clamped inside the operator floor/ceiling; balanced === the raw knobs).
  const eff = effectiveCadence();
  const ambientProb = eff.ambientProb;
  const nudgeProb = eff.nudgeProb;
  const renudgeBaseMs = eff.renudgeBaseMs;
  const maxNudges = num('LUNA_PROACTIVE_MAX_NUDGES', 3);
  const dormantRecoveryMs = num('LUNA_PROACTIVE_DORMANT_RECOVERY_MS', 3_600_000); // 1h
  const longAbsenceMs = num('LUNA_PROACTIVE_LONG_ABSENCE_MS', 64_800_000); // 18h

  const userGap = session.lastUserMs > 0 ? nowMs - session.lastUserMs : Infinity;
  const sinceProactive = cadence.lastProactiveMs > 0 ? nowMs - cadence.lastProactiveMs : Infinity;
  // effective_gap (proactive.py:277-281): count her own outreach too.
  const effectiveGap = Math.min(userGap, sinceProactive);

  let phase: ProactivePhase = cadence.phase;
  let nudgesSent = cadence.nudgesSent;
  const decide = (scenario: ProactiveScenario | null): LadderDecision => ({ scenario, phase, nudgesSent });

  // The user spoke since her last outreach → a fresh silence; reset the escalation. (Python
  // resets on any user interaction via last_seen_interaction; here we derive it read-time from
  // lastUserMs vs lastProactiveMs, so v0.24.0 never has to touch the reactive turn path.)
  if (
    session.lastUserMs > 0 &&
    session.lastUserMs > cadence.lastProactiveMs &&
    (phase === 'nudged' || phase === 'idle_watch' || phase === 'dormant' || phase === 'sleeping')
  ) {
    phase = 'engaged';
    nudgesSent = 0;
  }

  // Long absence → sleeping; she waits for him to return, does not nudge into it (proactive.py:260-262).
  if (effectiveGap > longAbsenceMs) {
    phase = 'sleeping';
    return decide(null);
  }

  // DORMANT auto-recovery after a genuine cool-down (proactive.py:288-295).
  if (phase === 'dormant') {
    if (effectiveGap >= dormantRecoveryMs) {
      phase = 'engaged';
      nudgesSent = 0;
    } else {
      return decide(null);
    }
  }
  if (phase === 'sleeping') return decide(null);

  // engaged → idle_watch once it's been quiet past the threshold (proactive.py:300-302); a shorter
  // lull may instead drop a weightless ambient musing.
  if (phase === 'engaged') {
    if (effectiveGap >= idleThresholdMs) {
      phase = 'idle_watch';
      // fall through to the idle_watch block
    } else {
      if (effectiveGap >= ambientMinMs && rng() < ambientProb) return decide('ambient');
      return decide(null);
    }
  }

  // idle_watch: offer an idle_nudge each eligible tick, gated only by the anti-spam min_interval the
  // rail already applied (NO idle-threshold re-check) — so a silent attempt keeps trying next tick
  // (proactive.py:308-311). She leaves idle_watch only by speaking (→nudged) or a user reply (→engaged).
  if (phase === 'idle_watch') {
    if (rng() < nudgeProb) return decide('idle_nudge');
    return decide(null);
  }

  if (phase === 'nudged') {
    // Backoff spacing — longer than the base cooldown the rail already enforced.
    if (sinceProactive < renudgeGapMs(nudgesSent, renudgeBaseMs)) return decide(null);
    if (nudgesSent < maxNudges) return decide('renudge');
    return decide('leave_message');
  }

  return decide(null);
}
