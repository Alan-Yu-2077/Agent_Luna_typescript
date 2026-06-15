// Skill library store (Initiative 8, v0.15.4). Wraps the `skills` table
// (migration 0009) via the shared memory DB connection (getMemoryDb), exactly
// like l3Store / repoMapCache — when the DB is unset (tests without setMemoryDb,
// LUNA_PERSIST=0) every call no-ops (save returns false, reads return empty), so
// the tools degrade to "can't persist" rather than crashing.
//
// A skill is verified-before-save data (the Voyager invariant: only working
// skills enter the library), recalled by description match. It is never executed.

import { getMemoryDb } from '../memory/sessionStore';
import { lexicalScore } from '../memory/recall/lexical';

export type Skill = {
  name: string;
  description: string;
  body: string;
  created_ms: number;
  verified_ms: number;
};

type Row = {
  name: string;
  description: string;
  body: string;
  created_ms: number;
  verified_ms: number;
};

// Upsert a skill. `created_ms` is preserved on update (first-seen time); the
// caller passes a fresh `verified_ms` each save (when it last passed verify).
// Returns false when there is no DB (nothing persisted).
export function saveSkill(
  skill: { name: string; description: string; body: string },
  nowMs: number,
): boolean {
  const db = getMemoryDb();
  if (!db) return false;
  const existing = db.prepare('SELECT created_ms FROM skills WHERE name = ?').get(skill.name) as
    | { created_ms: number }
    | null;
  const created = existing ? existing.created_ms : nowMs;
  db.prepare(
    `INSERT INTO skills (name, description, body, created_ms, verified_ms)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET
       description = excluded.description,
       body = excluded.body,
       verified_ms = excluded.verified_ms`,
  ).run(skill.name, skill.description, skill.body, created, nowMs);
  return true;
}

export function getSkill(name: string): Skill | null {
  const db = getMemoryDb();
  if (!db) return null;
  return (db
    .prepare('SELECT name, description, body, created_ms, verified_ms FROM skills WHERE name = ?')
    .get(name) as Row | null) ?? null;
}

export function listSkills(limit = 50): Skill[] {
  const db = getMemoryDb();
  if (!db) return [];
  return db
    .prepare(
      'SELECT name, description, body, created_ms, verified_ms FROM skills ORDER BY verified_ms DESC LIMIT ?',
    )
    .all(limit) as Row[];
}

// Rank skills by a lexical match of the query against name + description (reuses
// the recall layer's CJK-aware bigram scorer). Falls back to recency on an empty
// query. Ties broken by recency (the LIMIT in listSkills already orders by it).
export function searchSkills(query: string, limit = 10): Skill[] {
  const all = listSkills(1000);
  if (!query.trim()) return all.slice(0, limit);
  return all
    .map((s) => ({ s, score: lexicalScore(query, `${s.name} ${s.description}`) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.s.verified_ms - a.s.verified_ms)
    .slice(0, limit)
    .map((x) => x.s);
}
