import type { Soul } from '@luna/protocol';
import { getMemoryDb } from './sessionStore';
import { bumpMemoryEpoch } from './epoch';
import { contentHash } from './recall/embed';

const EMPTY: Soul = { fixed_text: '', evolving_self: '', evolving_bond: '', updated_ms: 0 };

// v0.30.1 (Initiative 22): the A/B flag. When on, the persona block renders from the DB soul
// (fixed core + evolving section) and the core block drops its self/relationship half. Default
// off keeps the v0.29.x file+core_memory path byte-identical. Removed at v0.30.3 (soul is the
// only path). Lives here so both renderSoul and renderCoreBlock read one source of truth.
export function soulDbEnabled(): boolean {
  return Bun.env['LUNA_SOUL_DB'] === '1';
}

export function getSoul(): Soul {
  const db = getMemoryDb();
  if (!db) return EMPTY;
  const row = db
    .prepare('SELECT fixed_text, evolving_self, evolving_bond, updated_ms FROM soul WHERE id = 1')
    .get() as Soul | null;
  return row ?? EMPTY;
}

// Hash-gated: an unchanged fixed_text (e.g. an unchanged default.md at boot)
// must be a true no-op — no write, no epoch bump — so re-seeding on every boot
// never busts the prompt cache. Preserves evolving_* untouched (upsert only
// touches fixed_text/fixed_hash).
export function seedFixedCore(fixedText: string): void {
  const db = getMemoryDb();
  if (!db) return;
  const hash = contentHash(fixedText);
  const row = db.prepare('SELECT fixed_hash FROM soul WHERE id = 1').get() as
    | { fixed_hash: string }
    | null;
  if (row && row.fixed_hash === hash) return; // unchanged — no-op (cache invariant)
  const now = Date.now();
  db.prepare(
    `INSERT INTO soul (id, fixed_text, fixed_hash, evolving_self, evolving_bond, updated_ms)
     VALUES (1, ?, ?, '', '', ?)
     ON CONFLICT(id) DO UPDATE SET fixed_text = excluded.fixed_text, fixed_hash = excluded.fixed_hash, updated_ms = excluded.updated_ms`,
  ).run(fixedText, hash, now);
  bumpMemoryEpoch();
}

export type EvolvingPatch = { self?: string; bond?: string };

// Straight port of coreMemory.updateCore's three load-bearing properties:
// audit-first, byte-identical-patch no-op guard, epoch bump on a real change.
export function updateEvolving(patch: EvolvingPatch, source: string): Soul | null {
  const db = getMemoryDb();
  if (!db) return null;
  const prev = getSoul();
  const evolving_self = patch.self ?? prev.evolving_self;
  const evolving_bond = patch.bond ?? prev.evolving_bond;
  if (evolving_self === prev.evolving_self && evolving_bond === prev.evolving_bond) {
    return prev;
  }
  db.prepare(
    'INSERT INTO soul_audit (t_ms, prev_self, prev_bond, source) VALUES (?, ?, ?, ?)',
  ).run(Date.now(), prev.evolving_self, prev.evolving_bond, source);
  const now = Date.now();
  db.prepare(
    `INSERT INTO soul (id, fixed_text, fixed_hash, evolving_self, evolving_bond, updated_ms)
     VALUES (1, '', '', ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET evolving_self = excluded.evolving_self, evolving_bond = excluded.evolving_bond, updated_ms = excluded.updated_ms`,
  ).run(evolving_self, evolving_bond, now);
  bumpMemoryEpoch(); // matches coreMemory.updateCore: cached system block re-renders on real change
  return { ...prev, evolving_self, evolving_bond, updated_ms: now };
}

export function restoreEvolving(steps = 1): Soul | null {
  const db = getMemoryDb();
  if (!db || steps < 1) return null;
  const rows = db
    .prepare(
      `SELECT prev_self, prev_bond FROM soul_audit
       WHERE source != 'restore' ORDER BY id DESC LIMIT ?`,
    )
    .all(steps) as { prev_self: string; prev_bond: string }[];
  const target = rows[steps - 1];
  if (!target) return null;
  return updateEvolving({ self: target.prev_self, bond: target.prev_bond }, 'restore');
}
