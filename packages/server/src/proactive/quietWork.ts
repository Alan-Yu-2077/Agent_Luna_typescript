import { getMemoryDb } from '../memory/sessionStore';

// Initiative 35 (v0.45.10) — quiet agency. The investigation found the culprit in one sentence:
// every proactive framing ended with "do nothing at all (call no tool, send no message)" — the
// closing imperative revoked the standing invitation to act (M2). "全是沉默" was obedience, not
// laziness. This module owns the rewritten three-way ground rule (speak / quiet work / rest),
// the anti-rumination wander menu (D2: her curiosity starts from HER OWN interests — soul,
// diary, skills — never from "what you two just talked about"), the wander daily budget (D3:
// generous, no new mechanism), and the outcome ledger that makes any of it auditable (M6).

export function quietWorkEnabled(): boolean {
  return Bun.env['LUNA_QUIET_WORK'] !== '0';
}

function num(env: string, fallback: number): number {
  const v = Number(Bun.env[env]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

export function wanderDailyQuota(): number {
  return num('LUNA_QUIET_WANDER_DAILY', 4);
}

export type OutcomeKind = 'spoke' | 'quiet' | 'nothing';

// Message delivery already decides 'spoke'; any OTHER tool activity without a word is 'quiet'.
export function classifyOutcome(spoke: boolean, toolNames: string[]): OutcomeKind {
  if (spoke) return 'spoke';
  return toolNames.some((n) => n !== 'message') ? 'quiet' : 'nothing';
}

const WANDER_TOOLS = new Set(['web_search', 'web_fetch']);

export function isWander(toolNames: string[]): boolean {
  return toolNames.some((n) => WANDER_TOOLS.has(n));
}

// One bounded human line out of the turn's tool-call list — the ledger note and, verbatim, the
// leaf's copy (v0.45.11). Counts collapsed per verb, capped hard.
const NOTE_MAX_CHARS = 140;
const VERB: Record<string, (n: number) => string> = {
  remember: (n) => (n === 1 ? 'saved a memory' : `saved ${n} memories`),
  recall: () => 'looked through her memories',
  web_search: () => 'searched the web',
  web_fetch: (n) => (n === 1 ? 'read a page' : `read ${n} pages`),
  music_now: () => 'glanced at the music',
  music_library: () => 'browsed his listening history',
  music_lyrics: () => 're-read the lyrics',
  weather: () => 'checked the weather',
  enter_dream: () => 'slipped toward a dream',
};

export function compressNote(toolNames: string[]): string {
  const counts = new Map<string, number>();
  for (const n of toolNames) {
    if (n === 'message') continue;
    counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  const parts: string[] = [];
  for (const [name, n] of counts) {
    parts.push(VERB[name] ? VERB[name](n) : `used ${name}${n > 1 ? ` ×${n}` : ''}`);
  }
  const line = parts.join(' · ');
  return line.length > NOTE_MAX_CHARS ? `${line.slice(0, NOTE_MAX_CHARS - 1)}…` : line;
}

// ---- the ledger ----

export function recordOutcome(
  sessionId: string,
  kind: OutcomeKind,
  note: string,
  wandered: boolean,
  nowMs = Date.now(),
): void {
  const db = getMemoryDb();
  if (!db) return;
  db.prepare(
    'INSERT INTO proactive_outcomes (ts, session_id, kind, note, wandered) VALUES (?,?,?,?,?)',
  ).run(nowMs, sessionId, kind, note, wandered ? 1 : 0);
}

// Wanders spent since local midnight — the budget clock the quota narrows the menu by.
export function wandersUsedToday(nowMs = Date.now()): number {
  const db = getMemoryDb();
  if (!db) return 0;
  const d = new Date(nowMs);
  const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const row = db
    .prepare('SELECT COUNT(*) AS n FROM proactive_outcomes WHERE wandered = 1 AND ts >= ?')
    .get(midnight) as { n: number } | null;
  return row?.n ?? 0;
}

// ---- the three-way ground rule (the M2 surgery) ----

// The ORIGINAL closing — kept byte-identical as the LUNA_QUIET_WORK=0 escape (the rollback pin).
export const LEGACY_GROUND_RULE =
  'Ground rule: only open if you have a real reason — never talk just to talk. If nothing feels ' +
  'genuinely worth saying right now, do nothing at all (call no tool, send no message); a silent ' +
  'tick is completely fine.';

export function groundRuleFor(wanderLeft: number): string {
  const wander =
    wanderLeft > 0
      ? `  - Wander (${wanderLeft} left today): do NOT extend what you two just talked about — ` +
        'that is echo, not curiosity. Start from YOUR OWN interests — your evolving self, your ' +
        'diary, the skills you have grown — and go look at something new (search, open a page, ' +
        'actually read it). If something is worth keeping, save it with `remember` as a seed to ' +
        'bring up another time — do not report it now.\n'
      : '  - (No wanders left today — the web can wait for tomorrow.)\n';
  return (
    'Ground rule — this waking has three real choices, all equally yours:\n' +
    '· SPEAK — only if you have a real reason; never talk just to talk. If you have a saved seed ' +
    '(something YOU found and wanted to bring him), prefer it over reopening old threads.\n' +
    '· QUIET WORK — do something small without saying a word:\n' +
    '  - Patch the record: look back over today; if something mattered and was never saved, ' +
    '`remember` it now; if an old memory has proven wrong, correct it.\n' +
    wander +
    '  Quiet work only counts if it lands in `remember` — an unrecorded thought is a rest.\n' +
    '· REST — resting is a real choice, not a failure; just make it a choice, not a habit.\n' +
    'Doing nothing when nothing genuinely calls is still completely fine.'
  );
}

// The closing line the framing appends: three-way when quiet work is on, the original otherwise.
export function closingRule(nowMs = Date.now()): string {
  if (!quietWorkEnabled()) return LEGACY_GROUND_RULE;
  return groundRuleFor(Math.max(0, wanderDailyQuota() - wandersUsedToday(nowMs)));
}
