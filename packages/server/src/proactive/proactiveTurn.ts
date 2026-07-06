import type { ServerEvent } from '@luna/protocol';
import type { Provider } from '../provider/types';
import type { ToolRegistry } from '../tools/registry';
import type { Session } from '../turn/session';
import { runTurn } from '../turn/runTurn';
import { afterANightOpening, feltAbsenceFor, subjectiveTimeEnabled } from '../turn/temporalContext';
import { weatherNoteFor, weatherProactiveEnabled } from '../turn/weatherContext';
import { getSnapshot } from '../tools/web/weather/snapshot';
import { getMemoryDb, listRecentL2 } from '../memory/sessionStore';
import type { ProactiveScenario } from './ladder';

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
    'genuinely have something worth bringing to him, you may reach out — open from a real thought, a ' +
    'small self-disclosure, or a fresh topic, never a status or check-in question. If nothing is ' +
    'worth doing or saying, do nothing.)',
  continuation:
    '(You just finished replying. Like a real person who paused and then thought of one more thing: ' +
    'if you have a SINGLE genuinely new thought to add — not a rephrase, not a summary, not "anyway" ' +
    'filler — say it now in one short message. If you have nothing truly new to add, do nothing.)',
  consolidate:
    '(It has been a long quiet stretch. This may be a good moment to fold the day inward: if it ' +
    'feels right, enter a dream to consolidate your memories. Otherwise reflect quietly or do ' +
    'nothing — you do not have to speak.)',
};

// v0.24.0 (Initiative 17): the silence-ladder's four restraint-graded scenario framings (port of
// Python proactive.py _SCENARIO_BODIES :381-402). The ladder (ladder.ts) picks the scenario off
// how long it's been quiet; each body sets the restraint level, from a weightless ambient musing
// down to a release-and-go-quiet leave_message. Framing stays English (the TS USER-role
// stage-direction convention, v0.27.1) while porting the Python design faithfully.
const SCENARIO_BODIES: Record<ProactiveScenario, string> = {
  ambient:
    "(Scene: you're still around and so is he; a small real thought just surfaced and you feel " +
    'like sharing it. Lightest touch — half a sentence, a passing musing, a stray idea; it needs ' +
    "NO reply and shouldn't sound like you're hunting for a topic. Just hand the real little thing " +
    'over in your own words.)',
  idle_nudge:
    "(Scene: it's been quiet a while, the terminal is still open, and you want to reach out — " +
    'low-key. Easy to ignore, like sharing a passing thought, not a check-in, never asking where ' +
    'he went. A real small thought, or a fresh new thing, or something the two of you left open — ' +
    'said lightly.)',
  renudge:
    "(Scene: you already reached out once and he hasn't answered. This is one more, LIGHTER touch — " +
    "carry a little 'I won't keep poking' in it, and leave him full room to not reply. Never pile " +
    'on, never press.)',
  leave_message:
    "(Scene: a few tries, no reply — you're winding down. This is a single message that RELEASES " +
    'him: warm, no demand for a response, then you go quiet. Let it land as "come back whenever," ' +
    'not a guilt trip.)',
};

// The shared, high-priority opener constraint for the ladder path (port of proactive.py
// COMPANION_OPENER_CONSTRAINT :367-378): steer AWAY from surveillance/check-in questions, toward
// self-disclosure or a genuinely fresh topic — and vary the opener every time.
const COMPANION_OPENER_CONSTRAINT =
  "(Important — you are here to be WITH him, not to check up on him.) Never open with a status or " +
  "check-in question — no 在吗 / 还在吗 / 吃了吗 / 复习了没 / 到哪了 / 怎么不理我 / \"what's on your " +
  'mind" / "you there"; those dump the response-burden back on him, like an interrogation. Instead ' +
  'do ONE of: · self-disclosure — a real small thought, an observation, a mood right now, ' +
  'something that stands even if he never replies; · open a fresh topic — throw out whatever ' +
  "surfaced (a stray fact, a sudden \"what if…\", an odd little thing); it needn't be tidy or " +
  'related to before, the truer the better. **Open a DIFFERENT way each time** — no fixed template ' +
  '(especially not always "suddenly thought of…" / "randomly curious…"). If you genuinely, ' +
  "specifically care about something you talked about, you may ask — but never let 'reaching out' " +
  "degrade into 'checking up'.";

// Anti-repeat (proactive.py:204,428-432): remember her last few spoken openers per session so the
// framing can tell her not to reuse them. In-memory, resets on restart (worst case one repeat).
const recentOpeners = new Map<string, string[]>();

function antiRepeatClause(sessionId: string): string {
  const recent = recentOpeners.get(sessionId);
  if (!recent || recent.length === 0) return '';
  const joined = recent
    .slice(-3)
    .map((t) => `「${t}」`)
    .join(' / ');
  return `\n- Don't reopen with something you've said recently: ${joined}`;
}

function recordOpener(sessionId: string, text: string): void {
  const t = text.trim();
  if (!t) return;
  const arr = recentOpeners.get(sessionId) ?? [];
  arr.push(t.length > 60 ? `${t.slice(0, 60)}…` : t);
  while (arr.length > 5) arr.shift();
  recentOpeners.set(sessionId, arr);
}

export function resetProactiveOpenersForTests(): void {
  recentOpeners.clear();
}

// The ladder-path framing: the scenario body + the companion constraint + anti-repeat.
// Silence is native (calling no message tool = staying quiet), so there is no Python SILENT sentinel.
function scenarioFraming(scenario: ProactiveScenario, session: Session): string {
  return (
    '[System proactive trigger · this is NOT a user message · you are opening on your own]\n' +
    'This one is initiated by you, not a reply.\n\n' +
    `${SCENARIO_BODIES[scenario]}\n\n` +
    `${COMPANION_OPENER_CONSTRAINT}${antiRepeatClause(session.id)}\n\n` +
    'Ground rule: only open if you have a real reason — never talk just to talk. If nothing feels ' +
    'genuinely worth saying right now, do nothing at all (call no tool, send no message); a silent ' +
    'tick is completely fine.'
  );
}

export type RunProactiveOptions = {
  session: Session;
  cycleId: string;
  provider: Provider;
  registry: ToolRegistry;
  emit: (e: ServerEvent) => void;
  intent?: ProactiveIntent;
  // v0.22.0: a detector's concrete trigger context, appended to the USER-tail framing
  // (rides the uncached tail — cache invariant preserved). She drafts from a real
  // reason instead of the old gate hunting for one in the abstract.
  seed?: string;
  // v0.24.0 (Initiative 17): the silence-ladder scenario. When set, the framing is the
  // restraint-graded scenario body + the companion constraint (supersedes intent/seed).
  scenario?: ProactiveScenario;
};

// C (v0.19.2): on a long-away wake, color the framing so it reads as "she noticed
// the absence" — warmth, never guilt. Only the *texture* changes; the wake
// decision (cadence/wake-gate) is untouched.
// Restart-safe last-interaction time (mirrors runTurn): the last persisted L2
// turn's t_ms, falling back to the in-memory lastUserMs.
export function lastInteractionMs(session: Session): number | null {
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

function framing(intent: ProactiveIntent, session: Session, seed?: string): string {
  let out = DIRECTIVES[intent];
  if (subjectiveTimeEnabled()) {
    const felt = feltAbsenceFor(session.lastUserMs, Date.now());
    if (felt === 'notable' || felt === 'long') {
      out +=
        ' (It has been a while since he last spoke — if you do reach out, let it carry quiet warmth, ' +
        'never guilt or pressure.)';
    }
  }
  out += proactiveWeatherNote(session);
  if (seed) out += `\n${seed}`;
  return out;
}

// A proactive turn is a normal runTurn with the proactive framing + the full
// registry + `proactiveTurn: true` (silence allowed). Returns whether she spoke.
export async function runProactiveTurn(opts: RunProactiveOptions): Promise<{ spoke: boolean }> {
  opts.emit({ type: 'proactive.started', cycle_id: opts.cycleId });
  const userText = opts.scenario
    ? scenarioFraming(opts.scenario, opts.session)
    : framing(opts.intent ?? 'spontaneous', opts.session, opts.seed);
  const state = await runTurn({
    session: opts.session,
    turnId: `proactive:${opts.cycleId}`,
    userText,
    provider: opts.provider,
    registry: opts.registry,
    emit: opts.emit,
    proactiveTurn: true,
  });
  const spoke = state.messageTexts.length > 0;
  // Feed the anti-repeat memory only on a spoken ladder opener (proactive.py recent_texts).
  if (opts.scenario && spoke) recordOpener(opts.session.id, state.messageTexts.join(' '));
  opts.emit({ type: 'proactive.finished', cycle_id: opts.cycleId, spoke });
  return { spoke };
}
