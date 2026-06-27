import type { ServerEvent } from '@luna/protocol';
import type { Provider } from '../provider/types';
import type { ToolRegistry } from '../tools/registry';
import type { Session } from '../turn/session';
import { runProactiveTurn } from './proactiveTurn';
import { withProactiveLock } from './fire';
import { proactiveEnabled } from './cadence';

// Self-continuation (Initiative 5, v0.11.0) — "a real person paused, then added
// one more thing." Not the heartbeat: a one-shot short timer right after a user
// turn, so the pause feels like seconds, not the 60s heartbeat. Reuses the
// proactive path with the `continuation` framing. Gated by a probability
// (mechanical, never a model-emitted "more to say" flag — Python v0.28.1 lesson).

export type ContinuationDeps = {
  session: Session;
  provider: Provider;
  registry: ToolRegistry;
  emit: (e: ServerEvent) => void;
  // Optional connectivity probe: if it returns false (the client disconnected
  // during the pause), skip the continuation entirely so a micro-wake doesn't burn
  // an LLM call no one will see (the heartbeat is different — it intentionally runs
  // unattended; a continuation is a reply-to-a-conversation that just ended).
  hasListener?: () => boolean;
};

// Decides whether to schedule a continuation. Pure-ish (reads env); a
// probability of 1 always continues, 0 never (deterministic for tests).
export function shouldContinue(): boolean {
  if (!proactiveEnabled()) return false;
  if (Bun.env['LUNA_SELFCONT'] === '0') return false;
  const prob = Number(Bun.env['LUNA_SELFCONT_PROBABILITY'] ?? 0.35);
  if (!(prob > 0)) return false;
  return Math.random() < prob;
}

// Runs the continuation micro-wake. v0.22.2: routed through the SHARED single-turn lock
// (withProactiveLock applies the activeTurn / isDreaming / proactiveEnabled rail), so a
// continuation and a scheduler/hook turn can never overlap. Deliberately rail-LIGHT: a
// continuation is a bounded one-per-reply micro-wake (LD #11), so it stays quota- and
// cooldown-exempt by design — no cadence commit here. Exported for tests.
export async function fireContinuation(deps: ContinuationDeps): Promise<void> {
  const { session } = deps;
  if (deps.hasListener && !deps.hasListener()) return; // client gone — don't waste a turn
  await withProactiveLock(session, () =>
    runProactiveTurn({
      session,
      cycleId: `${session.id}:cont:${Date.now()}`,
      provider: deps.provider,
      registry: deps.registry,
      emit: deps.emit,
      intent: 'continuation',
    }),
  );
}

// Call after a user turn finalizes: maybe schedule a continuation after a short
// pause. Fire-and-forget; never throws into the caller.
export function maybeScheduleContinuation(deps: ContinuationDeps): void {
  if (!shouldContinue()) return;
  const pauseMs = Number(Bun.env['LUNA_SELFCONT_PAUSE_MS'] ?? 4000);
  const timer = setTimeout(() => {
    void fireContinuation(deps).catch(() => {
      /* continuation is best-effort */
    });
  }, pauseMs);
  // Never let a pending continuation hold the process open at shutdown.
  (timer as { unref?: () => void }).unref?.();
}
