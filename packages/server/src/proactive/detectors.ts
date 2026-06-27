import type { Session } from '../turn/session';
import { afterANightOpening } from '../turn/temporalContext';
import { getSnapshot } from '../tools/web/weather/snapshot';
import type { WeatherSnapshot, WeatherUnits } from '../tools/web/weather/openMeteo';
import { listFacts } from '../memory/l3Store';
import { listRecentL2 } from '../memory/sessionStore';
import { lastInteractionMs, type ProactiveIntent } from './proactiveTurn';
import { type Cadence, isSlotConsumed, scheduledSlots } from './cadence';

function num(env: string, fallback: number): number {
  const v = Number(Bun.env[env]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

// v0.22.1 (Initiative 15): the deterministic proactive detector registry — cheap, pure,
// LLM-free triggers evaluated each tick. First match wins; the matched trigger's seed is
// appended to the proactive turn's framing, and the turn itself decides whether to speak
// (drafting-as-decision). This replaces the old per-tick LLM wake-gate's "is there a
// reason?" judgment with concrete, code-detected reasons.

export type DetectorCtx = {
  session: Session;
  cadence: Cadence;
  nowMs: number;
  nowHour: number;
};

export type ProactiveTrigger = {
  intent: ProactiveIntent;
  seed: string;
  // identifies the trigger for per-slot/day debouncing (e.g. 'after_night', 'slot:11').
  debounceKey: string;
};

export type ProactiveDetector = {
  name: string;
  detect: (ctx: DetectorCtx) => ProactiveTrigger | null;
};

const AFTER_NIGHT_SEED =
  '(Context: this is the first time you are seeing Alan again after a night — or a longer ' +
  'absence. A warm, natural hello, or quietly picking up a real thread from before, would fit ' +
  'here — only if you genuinely have something to bring; never a status or check-in question, ' +
  'and staying silent is completely fine.)';

const SCHEDULED_SEED =
  "(Context: it's around your usual time to check in. If something is genuinely on your mind — a " +
  'thought, a small update, a thread worth picking back up — you might share it; if nothing is, ' +
  'let this moment pass in silence. Never open with a status or check-in question.)';

// First contact after a night (or a longer absence) — wraps the existing
// afterANightOpening (gap >= 6h + morning daypart + crosses a day). Self-debounces:
// once she greets, the proactive turn persists to L2, so lastInteractionMs is recent and
// the gap drops below 6h on the next tick.
const afterNight: ProactiveDetector = {
  name: 'after_night',
  detect: (ctx) =>
    afterANightOpening(ctx.nowMs, lastInteractionMs(ctx.session))
      ? { intent: 'spontaneous', seed: AFTER_NIGHT_SEED, debounceKey: 'after_night' }
      : null,
};

// A scheduled daily opening — a guaranteed speaking floor independent of any content
// trigger. Fires at most once per configured local hour per day (the per-day slot
// bitmask, marked consumed by the scheduler after the turn runs).
const scheduledWindow: ProactiveDetector = {
  name: 'scheduled_window',
  detect: (ctx) => {
    if (!scheduledSlots().includes(ctx.nowHour)) return null;
    if (isSlotConsumed(ctx.cadence, ctx.nowHour, ctx.nowMs)) return null;
    return { intent: 'spontaneous', seed: SCHEDULED_SEED, debounceKey: `slot:${ctx.nowHour}` };
  },
};

// v0.22.2 (Initiative 15): a notable weather change — the moment it starts raining, snow
// arrives, a storm rolls in. Coarse buckets (condition CLASS + a wide temp band) so ordinary
// fluctuation never triggers; fires once on a bucket change, then the per-key debounce caps
// re-firing if it oscillates. Reads ONLY the already-cached snapshot (never the network);
// cold cache → silent.
let weatherBaseline: string | null = null; // last-evaluated bucket; in-memory, resets on restart

function conditionClass(condition: string): string {
  const c = condition.toLowerCase();
  if (c.includes('thunder')) return 'storm';
  if (c.includes('snow') || c.includes('grains')) return 'snow';
  if (c.includes('rain') || c.includes('drizzle') || c.includes('shower') || c === 'wet') {
    return 'rain';
  }
  if (c.includes('fog')) return 'fog';
  if (c.includes('cloud') || c === 'overcast') return 'cloudy';
  if (c.includes('clear')) return 'clear';
  return 'other';
}

// Wide bands (normalized to °C) so a normal daily swing stays in one band — only a real
// regime change (cold front, heatwave) crosses one.
function tempBand(temp: number, units: WeatherUnits): string {
  const t = units === 'fahrenheit' ? ((temp - 32) * 5) / 9 : temp;
  if (t < 5) return 'frigid';
  if (t < 12) return 'cold';
  if (t < 20) return 'mild';
  if (t < 28) return 'warm';
  return 'hot';
}

function weatherBucket(s: WeatherSnapshot): string {
  return `${conditionClass(s.condition)}:${tempBand(s.temp, s.units)}`;
}

function weatherShiftSeed(s: WeatherSnapshot): string {
  const deg = `${Math.round(s.temp)}°${s.units === 'fahrenheit' ? 'F' : 'C'}`;
  return (
    `(Context: the weather outside just changed — it's now ${s.condition}, around ${deg}. If it ` +
    'moves you to say something small and human about it — a passing notice, a bit of care for how ' +
    'it lands on Alan — you might; if not, let it pass. Never a forecast, never a status question.)'
  );
}

// Advances `weatherBaseline` as a side effect (the only way to fire once per change). First
// observation just seeds the baseline (you can't shift from nothing); a later bucket change
// fires and re-seeds.
const weatherShift: ProactiveDetector = {
  name: 'weather_shift',
  detect: () => {
    if (Bun.env['LUNA_PROACTIVE_WEATHER_SHIFT'] === '0') return null;
    const snap = getSnapshot();
    if (!snap) return null; // cold/stale cache → nothing to compare
    const bucket = weatherBucket(snap);
    if (weatherBaseline === null) {
      weatherBaseline = bucket; // first sight — seed, don't fire
      return null;
    }
    if (bucket === weatherBaseline) return null;
    weatherBaseline = bucket;
    return { intent: 'spontaneous', seed: weatherShiftSeed(snap), debounceKey: `weather:${bucket}` };
  },
};

export function resetWeatherBaselineForTests(): void {
  weatherBaseline = null;
}

// v0.22.3 (Initiative 15, close): two "soft" detectors that need heuristics — so they ship
// DEFAULT-OFF and seed gently (a stale/false positive yields silence, never an awkward nudge).
// Both are pure + clock-injectable (read DB state, compare against ctx.nowMs).

function openThreadSeed(thread: string): string {
  return (
    `(Context: a thread may still be open between you and Alan — "${thread}". Only bring it up if it ` +
    'still feels alive and you genuinely have something to add; if it is stale or already settled, let ' +
    'it rest in silence. Never a status or check-in question.)'
  );
}

// An L3 active_thread that has been open longer than the age threshold. Picks the newest aged
// thread (most likely still relevant); the per-key debounce (thread:<id>) keeps it from
// re-raising the same one. Seeds softly — the turn still decides whether the thread is alive.
const openThreadAged: ProactiveDetector = {
  name: 'open_thread_aged',
  detect: (ctx) => {
    if (Bun.env['LUNA_PROACTIVE_OPEN_THREADS'] !== '1') return null;
    const minAgeMs = num('LUNA_PROACTIVE_THREAD_AGE_MS', 24 * 3_600_000);
    const aged = listFacts({ category: 'active_threads' }).filter(
      (f) => ctx.nowMs - f.created_ms >= minAgeMs,
    );
    const t = aged[aged.length - 1]; // newest among the aged (listFacts is created_ms ASC)
    if (!t) return null;
    return { intent: 'spontaneous', seed: openThreadSeed(t.text), debounceKey: `thread:${t.id}` };
  },
};

// A prior "I'll do/check X" beat that has had no follow-up. Conservative: fires only when the
// NEWEST persisted turn is itself a promise-shaped line within an age WINDOW (older than the min
// threshold so nothing has come after it, but not so old it's effectively abandoned — the upper
// bound stops a never-followed-up promise from re-firing forever, since a silent proactive turn
// writes no new L2 row to advance past it). Default-off; soft seed; debounceKey hashes the text.
// The patterns require a COMMITMENT phrase (a real action + object/particle), not bare everyday
// verbs — "I'll see you" / "let me see if…" / "我看看窗外" are reflection, not promises.
const PROMISE_PATTERNS: RegExp[] = [
  /\b(i'?ll|i will|i'?m going to|let me)\b[^.!?]{0,40}\b(look into|look up|get back to you|figure (?:it|that|this) out|dig into|follow up|find out|check (?:on|into|in with)|sort (?:it|that|this) out|work on|put together|send (?:it|you|that|the|over)|get (?:it|that|you) (?:done|sorted)|circle back|report back)\b/i,
  /(稍后|待会|回头|等下|等会|过会|晚点|明天|一会)[^。！？]{0,30}(帮你|给你|替你|去)?(查一下|查查|看一下|找一下|确认|搞定|整理|跟进|研究|弄好|发给你|回复你|处理)/,
];

function looksLikePromise(text: string): boolean {
  return PROMISE_PATTERNS.some((re) => re.test(text));
}

function promiseHash(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function promiseSeed(saidEarlier: string): string {
  const snip = saidEarlier.length > 80 ? `${saidEarlier.slice(0, 80)}…` : saidEarlier;
  return (
    `(Context: a while ago you said you'd follow up on something — "${snip}". If you actually have the ` +
    'follow-through now, this is a natural moment to bring it; if not, or if it no longer matters, stay ' +
    'quiet. Never a hollow check-in.)'
  );
}

const promisedFollowThrough: ProactiveDetector = {
  name: 'promised_follow_through',
  detect: (ctx) => {
    if (Bun.env['LUNA_PROACTIVE_FOLLOW_THROUGH'] !== '1') return null;
    const minAgeMs = num('LUNA_PROACTIVE_PROMISE_AGE_MS', 6 * 3_600_000);
    const maxAgeMs = num('LUNA_PROACTIVE_PROMISE_MAX_AGE_MS', 36 * 3_600_000);
    const rows = listRecentL2(ctx.session.id, 1);
    const last = rows[rows.length - 1];
    if (!last || last.assistant_text === '') return null;
    const age = ctx.nowMs - last.t_ms;
    // Window, not just a floor: too recent OR effectively abandoned. The upper bound matters
    // because a SILENT proactive turn persists no L2 row — without it, an unfollowed promise
    // stays the newest row and re-fires every debounce window indefinitely.
    if (age < minAgeMs || age >= maxAgeMs) return null;
    if (!looksLikePromise(last.assistant_text)) return null;
    return {
      intent: 'spontaneous',
      seed: promiseSeed(last.assistant_text),
      debounceKey: `promise:${promiseHash(last.assistant_text)}`,
    };
  },
};

// Ordered by priority — the morning greeting beats the scheduled floor beats opportunistic
// content triggers (weather, then the heuristic soft detectors) when more than one lands at
// once.
const REGISTRY: ProactiveDetector[] = [
  afterNight,
  scheduledWindow,
  weatherShift,
  openThreadAged,
  promisedFollowThrough,
];

export function evaluateDetectors(ctx: DetectorCtx): ProactiveTrigger | null {
  for (const d of REGISTRY) {
    const hit = d.detect(ctx);
    if (hit) return hit;
  }
  return null;
}
