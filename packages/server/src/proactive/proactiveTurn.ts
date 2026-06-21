import type { ServerEvent } from '@luna/protocol';
import type { Provider } from '../provider/types';
import type { ToolRegistry } from '../tools/registry';
import type { Session } from '../turn/session';
import { runTurn } from '../turn/runTurn';
import { afterANightOpening, feltAbsenceFor, subjectiveTimeEnabled } from '../turn/temporalContext';
import { weatherNoteFor, weatherProactiveEnabled } from '../turn/weatherContext';
import { getSnapshot } from '../tools/web/weather/snapshot';
import { getMemoryDb, listRecentL2 } from '../memory/sessionStore';

// The proactive framing — a USER-role stage direction (never system: the
// v0.27.1 hoisting lesson). She woke on her own; acting via tools is the point,
// and speaking is optional. The companion-opener constraint (ported from Python
// proactive.py) keeps her from opening with status/check-in questions IF she
// does reach out.
// Each proactive intent gets its own USER-role stage direction (never system —
// the v0.27.1 hoisting lesson). All keep the companion-opener constraint.
export type ProactiveIntent = 'spontaneous' | 'continuation' | 'consolidate';

const DIRECTIVES: Record<ProactiveIntent, string> = {
  spontaneous:
    '(You woke on your own — no one just spoke to you. This is your own moment. You may reflect, ' +
    'recall something, save or revise a memory, look something up, or simply sit with a thought — ' +
    'calling a tool is acting, and you do not have to say anything at all. If, and only if, you ' +
    'genuinely have something worth bringing to the user, you may reach out — but never open with a ' +
    'status or check-in question (在吗 / 吃了吗 / 到哪了 / 怎么不理我); start from a real thought, a ' +
    'small self-disclosure, or a fresh topic. If nothing is worth doing or saying, do nothing.)',
  continuation:
    '(You just finished replying. Like a real person who paused and then thought of one more thing: ' +
    'if you have a SINGLE genuinely new thought to add — not a rephrase, not a summary, not "anyway" ' +
    'filler — say it now in one short message. If you have nothing truly new to add, do nothing.)',
  consolidate:
    '(It has been a long quiet stretch. This may be a good moment to fold the day inward: if it ' +
    'feels right, enter a dream to consolidate your memories. Otherwise reflect quietly or do ' +
    'nothing — you do not have to speak.)',
};

export type RunProactiveOptions = {
  session: Session;
  cycleId: string;
  provider: Provider;
  registry: ToolRegistry;
  emit: (e: ServerEvent) => void;
  intent?: ProactiveIntent;
};

// C (v0.19.2): on a long-away wake, color the framing so it reads as "she noticed
// the absence" — warmth, never guilt. Only the *texture* changes; the wake
// decision (cadence/wake-gate) is untouched.
// Restart-safe last-interaction time (mirrors runTurn): the last persisted L2
// turn's t_ms, falling back to the in-memory lastUserMs.
function lastInteractionMs(session: Session): number | null {
  const row = getMemoryDb() ? listRecentL2(session.id, 1)[0] : undefined;
  return row?.t_ms ?? (session.turnSeq > 0 ? session.lastUserMs : null);
}

// Initiative 14 (v0.21.2): a bounded, ignorable weather note for an after-a-night
// / morning wake — care, not forecast. Reads the cached snapshot (never fetches);
// rides the opening framing only (the wake decision is untouched). Exported for
// testing with an injected nowMs (the morning gate uses real time).
export function proactiveWeatherNote(session: Session, nowMs = Date.now()): string {
  if (!weatherProactiveEnabled()) return '';
  if (!afterANightOpening(nowMs, lastInteractionMs(session))) return '';
  return weatherNoteFor(getSnapshot()) ?? '';
}

function framing(intent: ProactiveIntent, session: Session): string {
  let out = DIRECTIVES[intent];
  if (subjectiveTimeEnabled()) {
    const felt = feltAbsenceFor(session.lastUserMs, Date.now());
    if (felt === 'notable' || felt === 'long') {
      out +=
        ' (It has been a while since the user spoke — if you do reach out, let it carry quiet warmth, ' +
        'never guilt or pressure.)';
    }
  }
  out += proactiveWeatherNote(session);
  return out;
}

// A proactive turn is a normal runTurn with the proactive framing + the full
// registry + `proactiveTurn: true` (silence allowed). Returns whether she spoke.
export async function runProactiveTurn(opts: RunProactiveOptions): Promise<{ spoke: boolean }> {
  opts.emit({ type: 'proactive.started', cycle_id: opts.cycleId });
  const state = await runTurn({
    session: opts.session,
    turnId: `proactive:${opts.cycleId}`,
    userText: framing(opts.intent ?? 'spontaneous', opts.session),
    provider: opts.provider,
    registry: opts.registry,
    emit: opts.emit,
    proactiveTurn: true,
  });
  const spoke = state.messageTexts.length > 0;
  opts.emit({ type: 'proactive.finished', cycle_id: opts.cycleId, spoke });
  return { spoke };
}
