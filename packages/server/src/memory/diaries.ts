import { getMemoryDb } from './sessionStore';

// v0.17.1 (Initiative 10): the diary read-side. Until now the only reader of the
// `diaries` table was the dream cycle (day→week rollup + rag_refresh embedding),
// so day/week/month summaries — the design's long-range narrative memory — never
// reached the model. This wires them in two ways: a standing digest in the cached
// system block, and recall candidates (collectCandidates). Behind LUNA_DIARY_INJECT.

export type DiaryRow = { kind: string; period_key: string; text: string; generated_ms: number };

// Default ON since v0.27.4 (the roadmap's "default off → on after validation"),
// matching every sibling perception/memory switch's !== '0' idiom;
// LUNA_DIARY_INJECT=0 is the off switch.
export function diaryInjectEnabled(): boolean {
  return Bun.env['LUNA_DIARY_INJECT'] !== '0';
}

// Per-entry truncation for the standing digest (a few hundred tokens total),
// read per-call so the knob is live.
function digestEntryChars(): number {
  return Number(Bun.env['LUNA_DIARY_DIGEST_ENTRY_CHARS'] ?? 600);
}

function latest(kind: string): DiaryRow | null {
  const db = getMemoryDb();
  if (!db) return null;
  return (
    (db
      .prepare(
        'SELECT kind, period_key, text, generated_ms FROM diaries WHERE kind = ? ORDER BY period_key DESC LIMIT 1',
      )
      .get(kind) as DiaryRow | null) ?? null
  );
}

// The most-recent diaries (any kind) as recall candidates — newest first.
export function listRecentDiaries(limit: number): DiaryRow[] {
  const db = getMemoryDb();
  if (!db) return [];
  return db
    .prepare(
      'SELECT kind, period_key, text, generated_ms FROM diaries ORDER BY generated_ms DESC LIMIT ?',
    )
    .all(limit) as DiaryRow[];
}

// A bounded standing digest of the latest day / week / month diary, for the
// cached system block. Empty string when injection is off or no diaries exist —
// it only changes when the dream writes a new diary, so the prefix cache stays
// stable between dream cycles.
export function renderDiaryDigest(): string {
  if (!diaryInjectEnabled()) return '';
  const parts: string[] = [];
  for (const kind of ['day', 'week', 'month'] as const) {
    const row = latest(kind);
    if (row)
      parts.push(`[${kind} ${row.period_key}] ${row.text.trim().slice(0, digestEntryChars())}`);
  }
  if (parts.length === 0) return '';
  return `## Your recent diary (days / weeks / months)\n${parts.join('\n\n')}`;
}
