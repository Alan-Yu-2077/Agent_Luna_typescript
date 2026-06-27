import type { Session } from '../turn/session';
import { afterANightOpening } from '../turn/temporalContext';
import { getSnapshot } from '../tools/web/weather/snapshot';
import type { WeatherSnapshot, WeatherUnits } from '../tools/web/weather/openMeteo';
import { lastInteractionMs, type ProactiveIntent } from './proactiveTurn';
import { type Cadence, isSlotConsumed, scheduledSlots } from './cadence';

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

// Ordered by priority — the morning greeting beats the scheduled floor beats an opportunistic
// weather remark when more than one lands on the same tick.
const REGISTRY: ProactiveDetector[] = [afterNight, scheduledWindow, weatherShift];

export function evaluateDetectors(ctx: DetectorCtx): ProactiveTrigger | null {
  for (const d of REGISTRY) {
    const hit = d.detect(ctx);
    if (hit) return hit;
  }
  return null;
}
