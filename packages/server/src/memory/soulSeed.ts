import { getMemoryDb } from './sessionStore';
import { getSoul, seedFixedCore } from './soulStore';
import { getCore } from './coreMemory';
import { loadPersona } from '../persona/loader';

// Boot-time seed for the soul substrate (Initiative 22, v0.30.0 — dark launch).
// Nothing reads the soul table yet; this only populates it so v0.30.1 can swap
// the render source over without a data migration in the critical path.
export function seedSoulOnBoot(): void {
  const db = getMemoryDb();
  if (!db) return;
  // Capture "never seeded" BEFORE seedFixedCore writes a row — its first-ever
  // insert sets updated_ms to now, so this signal must be read first.
  const neverSeeded = getSoul().updated_ms === 0;
  seedFixedCore(loadPersona().text);
  if (!neverSeeded) return;
  // One-time migration: copy core_memory verbatim into the evolving section.
  // A direct write (not updateEvolving) — no audit row for a migration, and
  // the neverSeeded guard above makes this idempotent across restarts.
  const core = getCore();
  db.prepare('UPDATE soul SET evolving_self = ?, evolving_bond = ?, updated_ms = ? WHERE id = 1').run(
    core.self_state,
    core.relationship_status,
    Date.now(),
  );
}
