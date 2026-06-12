import type { L3Category, L3Confidence, L3Fact } from '@luna/protocol';
import { getMemoryDb } from './sessionStore';

const ACTIVE_THREAD_TTL_MS = Number(Bun.env['LUNA_ACTIVE_THREAD_TTL_DAYS'] ?? 14) * 86_400_000;

const ID_PREFIX: Record<L3Category, string> = {
  core_facts: 'cf',
  preferences: 'pf',
  key_moments: 'km',
  active_threads: 'at',
  project_context: 'pc',
};

// Punctuation/whitespace-normalized key so trivially-restated facts dedupe
// (ported from Python semantic_memory._dedup_key).
export function dedupKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '')
    .trim();
}

export type AddResult = { status: 'added' | 'deduped'; id: string };

export function addFact(
  category: L3Category,
  text: string,
  confidence?: L3Confidence,
): AddResult | null {
  const db = getMemoryDb();
  if (!db) return null;
  const key = dedupKey(text);
  const existing = db
    .prepare('SELECT id FROM l3_facts WHERE dedup_key = ? AND deleted_ms IS NULL LIMIT 1')
    .get(key) as { id: string } | null;
  if (existing) return { status: 'deduped', id: existing.id };

  const now = Date.now();
  const id = `${ID_PREFIX[category]}_${now.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
  const expires = category === 'active_threads' ? now + ACTIVE_THREAD_TTL_MS : null;
  db.prepare(
    `INSERT INTO l3_facts (id, category, text, dedup_key, confidence, created_ms, expires_ms, deleted_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
  ).run(id, category, text, key, confidence ?? null, now, expires);
  return { status: 'added', id };
}

export type ForgetResult = { status: 'forgotten' | 'not_found'; id: string };

// Soft delete: sets deleted_ms, never removes the row. "This was once true"
// stays queryable via asOf — the deliberate divergence from Python's hard-delete.
export function forgetFact(id: string): ForgetResult | null {
  const db = getMemoryDb();
  if (!db) return null;
  const result = db
    .prepare('UPDATE l3_facts SET deleted_ms = ? WHERE id = ? AND deleted_ms IS NULL')
    .run(Date.now(), id);
  return { status: result.changes === 1 ? 'forgotten' : 'not_found', id };
}

export type ListOptions = {
  category?: L3Category;
  asOf?: number;
  limit?: number;
};

export function listFacts(opts: ListOptions = {}): L3Fact[] {
  const db = getMemoryDb();
  if (!db) return [];
  const at = opts.asOf ?? Date.now();
  const clauses = ['created_ms <= ?', '(deleted_ms IS NULL OR deleted_ms > ?)', '(expires_ms IS NULL OR expires_ms > ?)'];
  const params: (string | number)[] = [at, at, at];
  if (opts.category) {
    clauses.push('category = ?');
    params.push(opts.category);
  }
  params.push(opts.limit ?? 1000);
  return db
    .prepare(
      `SELECT id, category, text, confidence, created_ms, expires_ms, deleted_ms
       FROM l3_facts WHERE ${clauses.join(' AND ')}
       ORDER BY created_ms ASC LIMIT ?`,
    )
    .all(...params) as L3Fact[];
}
