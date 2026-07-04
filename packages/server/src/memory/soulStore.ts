import type { Soul } from '@luna/protocol';
import { getMemoryDb } from './sessionStore';
import { bumpMemoryEpoch } from './epoch';
import { contentHash } from './recall/embed';

const EMPTY: Soul = { fixed_text: '', evolving_self: '', evolving_bond: '', updated_ms: 0 };

export function getSoul(): Soul {
  const db = getMemoryDb();
  if (!db) return EMPTY;
  const row = db
    .prepare('SELECT fixed_text, evolving_self, evolving_bond, updated_ms FROM soul WHERE id = 1')
    .get() as Soul | null;
  return row ?? EMPTY;
}

// Seed-if-empty (v0.31.0): the fixed core is the human owner's to maintain in the DB, so the git
// persona file is only a FIRST-BOOT template. Once the soul holds a non-empty fixed core (seeded
// once, or since edited by the owner via the workspace), never re-clobber it from the file — an
// unchanged boot is a true no-op (no write, no epoch bump → the prompt-cache block stays identical).
// (Before v0.31.0 the file was authoritative and overwrote the DB whenever default.md's hash changed,
// so the owner could not customize the core without editing code. fixed_hash is now vestigial for
// seeding — kept as metadata that updateFixedCore/seed still stamp.)
export function seedFixedCore(fixedText: string): void {
  const db = getMemoryDb();
  if (!db) return;
  const row = db.prepare('SELECT fixed_text FROM soul WHERE id = 1').get() as
    | { fixed_text: string }
    | null;
  if (row && row.fixed_text.trim().length > 0) return; // already owned — never clobber
  const now = Date.now();
  db.prepare(
    `INSERT INTO soul (id, fixed_text, fixed_hash, evolving_self, evolving_bond, updated_ms)
     VALUES (1, ?, ?, '', '', ?)
     ON CONFLICT(id) DO UPDATE SET fixed_text = excluded.fixed_text, fixed_hash = excluded.fixed_hash, updated_ms = excluded.updated_ms`,
  ).run(fixedText, contentHash(fixedText), now);
  bumpMemoryEpoch();
}

// Owner-authoritative edit of the fixed core (v0.31.0) — the write behind the workspace soul editor.
// The fixed core is the human owner's; Luna's autonomous processes (dream / tools) never call this,
// so the fixed-core firewall (a dream can never touch fixed_text) is unchanged. No-op-guarded +
// epoch-bumped, so an edit lands on the next turn without busting the cache on a non-change. Preserves
// the evolving section (ON CONFLICT touches only fixed_text/fixed_hash/updated_ms).
export function updateFixedCore(fixedText: string): Soul | null {
  const db = getMemoryDb();
  if (!db) return null;
  const prev = getSoul();
  if (fixedText === prev.fixed_text) return prev;
  const now = Date.now();
  db.prepare(
    `INSERT INTO soul (id, fixed_text, fixed_hash, evolving_self, evolving_bond, updated_ms)
     VALUES (1, ?, ?, '', '', ?)
     ON CONFLICT(id) DO UPDATE SET fixed_text = excluded.fixed_text, fixed_hash = excluded.fixed_hash, updated_ms = excluded.updated_ms`,
  ).run(fixedText, contentHash(fixedText), now);
  bumpMemoryEpoch();
  return { ...prev, fixed_text: fixedText, updated_ms: now };
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
