// Initiative 12 (time perception) — all temporal arithmetic happens HERE, in TS.
// Benchmarks show LLMs can't reliably compute "how long ago", so we never ask:
// the model is handed labeled facts (now, daypart, elapsed, bucket) and told to
// trust them. Pure + deterministic + timezone-explicit (the one real correctness
// risk). v0.19.0 = A (passive injection); v0.19.1 reuses relativeLabel; v0.19.2
// adds subjectiveTime.

export type Daypart = 'late night' | 'morning' | 'afternoon' | 'evening';
export type GapBucket = 'first' | 'continuation' | 'same_day' | 'new_day' | 'long_away';

// Master switch for the passive time layer (A). Default ON since v0.19.2.
export function timeAwareEnabled(): boolean {
  return Bun.env['LUNA_TIME_AWARE'] !== '0';
}

// Felt/subjective time (C). Default ON since v0.19.2.
export function subjectiveTimeEnabled(): boolean {
  return Bun.env['LUNA_TIME_SUBJECTIVE'] !== '0';
}

export type AbsenceFeltness = 'none' | 'slight' | 'notable' | 'long';

const DAYPART_MOOD: Record<Daypart, string> = {
  'late night': "it's late and quiet — a softer, lower-energy register fits",
  morning: 'a fresh morning — bright and unhurried',
  afternoon: 'mid-afternoon — steady and present',
  evening: 'evening — warm and winding down',
};

const FELTNESS_BY_BUCKET: Record<GapBucket, AbsenceFeltness> = {
  first: 'none',
  continuation: 'none',
  same_day: 'slight',
  new_day: 'notable',
  long_away: 'long',
};

// A tiny, bounded, stateless subjective signal — recomputed from time each turn,
// never stored or escalating. The model may voice it or ignore it (a suggestion,
// not a directive); the L1 clause enforces warmth-not-guilt.
export function subjectiveTime(
  daypart: Daypart,
  bucket: GapBucket,
): { daypartMood: string; absenceFeltness: AbsenceFeltness } {
  return { daypartMood: DAYPART_MOOD[daypart], absenceFeltness: FELTNESS_BY_BUCKET[bucket] };
}

// Felt-absence for a gap (daypart-independent) — used to color a proactive wake's
// framing (v0.19.2 C, light proactive integration).
export function feltAbsenceFor(
  lastInteractionMs: number | null,
  nowMs: number,
  tz = resolveTz(),
): AbsenceFeltness {
  if (lastInteractionMs == null) return 'none';
  const gapSec = (nowMs - lastInteractionMs) / 1000;
  const crosses = localDayNumber(nowMs, tz) !== localDayNumber(lastInteractionMs, tz);
  return subjectiveTime('afternoon', classifyGap(gapSec, crosses)).absenceFeltness;
}

function absencePhrase(feltness: AbsenceFeltness): string {
  switch (feltness) {
    case 'none':
      return '';
    case 'slight':
      return " It hasn't been long.";
    case 'notable':
      return " It's been a bit since you talked — you can let that show as warmth if it feels right.";
    case 'long':
      return " It's been a while since you talked — you can let that land as warmth, never as guilt.";
  }
}

// LUNA_TZ (an IANA zone, e.g. Asia/Shanghai) → host-resolved zone → UTC. Read
// per-call so the knob is live; the block always states the zone it used. The
// value is VALIDATED — a typo (`Asia/Shanghi`, `PST`) would otherwise throw
// RangeError the first time it reached Intl, bricking every turn before the LLM
// (the time layer is non-essential, so a bad zone degrades, never fails).
function hostZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
}
export function resolveTz(): string {
  const tz = Bun.env['LUNA_TZ'] ?? hostZone();
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    console.warn(`[time] invalid LUNA_TZ "${tz}" — falling back to host zone/UTC`);
    return hostZone();
  }
}

export type GeoLocation = { lat: number; lon: number; label?: string };

// LUNA_LAT_LON ('lat,lon' decimal) → a validated coordinate, or null when unset
// or malformed. Read per-call so the knob is live; degrade-not-throw (mirrors
// resolveTz) — an unconfigured/bad location omits weather rather than guessing or
// bricking a turn. IP-geolocation is deliberately NOT used (Initiative 14): the
// deploy host's fake-IP proxy would report the exit node, not the user.
export function resolveLocation(): GeoLocation | null {
  const raw = Bun.env['LUNA_LAT_LON'];
  if (raw == null || raw.trim().length === 0) return null;
  const parts = raw.split(',').map((s) => s.trim());
  if (parts.length !== 2) {
    console.warn(`[weather] invalid LUNA_LAT_LON "${raw}" — expected "lat,lon"`);
    return null;
  }
  const lat = Number(parts[0]);
  const lon = Number(parts[1]);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    console.warn(`[weather] invalid LUNA_LAT_LON "${raw}" — out of range`);
    return null;
  }
  const label = Bun.env['LUNA_WEATHER_LOCATION']?.trim();
  return label != null && label.length > 0 ? { lat, lon, label } : { lat, lon };
}

type LocalParts = { year: number; month: number; day: number; hour: number; minute: number };

function localParts(ms: number, tz: string): LocalParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(ms));
  const get = (t: string): number => Number(parts.find((p) => p.type === t)?.value ?? '0');
  // '24' at midnight in some engines → normalize to 0
  const hour = get('hour') % 24;
  return { year: get('year'), month: get('month'), day: get('day'), hour, minute: get('minute') };
}

// A stable per-tz calendar-day index, so day diffs + "crosses a calendar day"
// are decided in code (never by the model).
function localDayNumber(ms: number, tz: string): number {
  const p = localParts(ms, tz);
  return Math.floor(Date.UTC(p.year, p.month - 1, p.day) / 86_400_000);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function localDateISO(ms: number, tz: string): string {
  const p = localParts(ms, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

function weekday(ms: number, tz: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(new Date(ms));
}

function tzOffsetLabel(ms: number, tz: string): string {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' })
    .formatToParts(new Date(ms))
    .find((p) => p.type === 'timeZoneName');
  return (part?.value ?? 'UTC').replace('GMT', 'UTC');
}

export function classifyDaypart(hour: number): Daypart {
  if (hour < 6) return 'late night';
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

// Humanized elapsed: just now / 1m / 1h 12m / 3h / 2 days.
export function formatGap(seconds: number): string {
  if (seconds < 45) return 'just now';
  // sub-hour uses floor (90s → "1m"), so it never reaches 60m.
  if (seconds < 3600) return `${Math.max(1, Math.floor(seconds / 60))}m`;
  if (seconds < 86_400) {
    let h = Math.floor(seconds / 3600);
    let m = Math.round((seconds % 3600) / 60);
    // carry the minute overflow so the within-hour round-up never renders
    // "1h 60m" / "23h 60m"; a value that carries past 24h falls through to days.
    if (m === 60) {
      h += 1;
      m = 0;
    }
    if (h < 24) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  const days = Math.round(seconds / 86_400);
  return `${days} day${days === 1 ? '' : 's'}`;
}

// Bucket from the gap AND whether it crosses a local calendar day — so "this
// morning vs yesterday" is decided here. null gap → first contact.
export function classifyGap(gapSeconds: number | null, crossesCalendarDay: boolean): GapBucket {
  if (gapSeconds == null) return 'first';
  const longAway = Number(Bun.env['LUNA_TIME_GAP_LONG_AWAY_S'] ?? 86_400);
  const continuation = Number(Bun.env['LUNA_TIME_GAP_CONTINUATION_S'] ?? 600);
  if (gapSeconds >= longAway) return 'long_away';
  if (crossesCalendarDay) return 'new_day';
  if (gapSeconds < continuation) return 'continuation';
  return 'same_day';
}

// Initiative 14 (v0.21.2): "the opening conversation after a night" — a new
// calendar day + an overnight-or-longer gap + the morning daypart. Composed from
// the existing helpers (no new arithmetic). The min-gap (default 6h) excludes a
// trivial chat that just straddled local midnight (classifyGap has no such gate).
export function afterANightOpening(
  nowMs: number,
  lastInteractionMs: number | null,
  tz = resolveTz(),
): boolean {
  if (lastInteractionMs == null) return false;
  const gapSec = (nowMs - lastInteractionMs) / 1000;
  const raw = Number(Bun.env['LUNA_NIGHT_MIN_GAP_SEC'] ?? 21_600);
  const minGap = Number.isFinite(raw) ? raw : 21_600;
  if (gapSec < minGap) return false;
  if (classifyDaypart(localParts(nowMs, tz).hour) !== 'morning') return false;
  const crosses = localDayNumber(nowMs, tz) !== localDayNumber(lastInteractionMs, tz);
  const bucket = classifyGap(gapSec, crosses);
  return bucket === 'new_day' || bucket === 'long_away';
}

// A relative-time label for a past moment, from the LOCAL calendar (v0.19.1 B):
// just now / this morning / yesterday / 3 days ago / on 2026-06-09 past horizon.
export function relativeLabel(tMs: number, nowMs: number, tz = resolveTz()): string {
  const sec = (nowMs - tMs) / 1000;
  if (sec < 180) return 'just now';
  const absDays = Number(Bun.env['LUNA_RECALL_ABS_DATE_DAYS'] ?? 7);
  const dayDiff = localDayNumber(nowMs, tz) - localDayNumber(tMs, tz);
  if (dayDiff <= 0) {
    const dp = classifyDaypart(localParts(tMs, tz).hour);
    return dp === 'late night' ? 'earlier today' : `this ${dp}`;
  }
  if (dayDiff === 1) return 'yesterday';
  if (dayDiff < absDays) return `${dayDiff} days ago`;
  return `on ${localDateISO(tMs, tz)}`;
}

function bucketPhrase(bucket: GapBucket, daypart: Daypart): string {
  switch (bucket) {
    case 'continuation':
      return 'still in the same conversation';
    case 'same_day':
      return `same day — still this ${daypart}`;
    case 'new_day':
      return 'a new day since you last talked';
    case 'long_away':
      return "it's been a while";
    case 'first':
      return '';
  }
}

export type TimeBlockOpts = {
  nowMs: number;
  lastInteractionMs: number | null;
  sessionStartMs: number;
  tz: string;
};

export function buildTimeBlock(opts: TimeBlockOpts): string {
  const { nowMs, lastInteractionMs, sessionStartMs, tz } = opts;
  const p = localParts(nowMs, tz);
  const daypart = classifyDaypart(p.hour);
  const nowLine = `- Now: ${weekday(nowMs, tz)}, ${localDateISO(nowMs, tz)} ${pad(p.hour)}:${pad(p.minute)} (${tz}, ${tzOffsetLabel(nowMs, tz)}) — ${daypart}`;

  let gapLine: string;
  let bucket: GapBucket;
  if (lastInteractionMs == null) {
    bucket = 'first';
    gapLine = '- Since the last message: first contact';
  } else {
    const gapSec = (nowMs - lastInteractionMs) / 1000;
    const crosses = localDayNumber(nowMs, tz) !== localDayNumber(lastInteractionMs, tz);
    bucket = classifyGap(gapSec, crosses);
    gapLine = `- Since the last message: ${formatGap(gapSec)} (${bucketPhrase(bucket, daypart)})`;
  }

  const sessionLine = `- This session: started ${formatGap((nowMs - sessionStartMs) / 1000)} ago`;

  const lines = [
    'Current time (you are handed this — do not compute durations yourself):',
    nowLine,
    gapLine,
    sessionLine,
  ];

  // C (v0.19.2): one bounded, suggestive felt-time line — the model may voice it
  // or ignore it; the L1 clause keeps it warmth-not-guilt.
  if (subjectiveTimeEnabled()) {
    const s = subjectiveTime(daypart, bucket);
    lines.push(`- Mood of the hour: ${s.daypartMood}.${absencePhrase(s.absenceFeltness)}`);
  }

  return lines.join('\n');
}
