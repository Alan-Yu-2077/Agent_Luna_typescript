import type { CoreMemory } from '@luna/protocol';
import { getMemoryDb } from './sessionStore';

const EMPTY: CoreMemory = { self_state: '', relationship_status: '', updated_ms: 0 };

export function getCore(): CoreMemory {
  const db = getMemoryDb();
  if (!db) return EMPTY;
  const row = db
    .prepare('SELECT self_state, relationship_status, updated_ms FROM core_memory WHERE id = 1')
    .get() as CoreMemory | null;
  return row ?? EMPTY;
}

export type CorePatch = { self_state?: string; relationship_status?: string };

// Audit-first: the PRIOR state is recorded before every write, so restore(n)
// can walk back n steps. Prose only — no structured fields, no consistency
// tripwire (Alan decision E + the kept-undo compromise).
export function updateCore(patch: CorePatch, source: string): CoreMemory | null {
  const db = getMemoryDb();
  if (!db) return null;
  const prev = getCore();
  db.prepare(
    'INSERT INTO core_memory_audit (t_ms, prev_self_state, prev_relationship, source) VALUES (?, ?, ?, ?)',
  ).run(Date.now(), prev.self_state, prev.relationship_status, source);
  const next: CoreMemory = {
    self_state: patch.self_state ?? prev.self_state,
    relationship_status: patch.relationship_status ?? prev.relationship_status,
    updated_ms: Date.now(),
  };
  db.prepare(
    'UPDATE core_memory SET self_state = ?, relationship_status = ?, updated_ms = ? WHERE id = 1',
  ).run(next.self_state, next.relationship_status, next.updated_ms);
  return next;
}

export function restore(steps = 1): CoreMemory | null {
  const db = getMemoryDb();
  if (!db || steps < 1) return null;
  const rows = db
    .prepare(
      `SELECT prev_self_state, prev_relationship FROM core_memory_audit
       WHERE source != 'restore' ORDER BY id DESC LIMIT ?`,
    )
    .all(steps) as { prev_self_state: string; prev_relationship: string }[];
  const target = rows[steps - 1];
  if (!target) return null;
  return updateCore(
    { self_state: target.prev_self_state, relationship_status: target.prev_relationship },
    'restore',
  );
}
