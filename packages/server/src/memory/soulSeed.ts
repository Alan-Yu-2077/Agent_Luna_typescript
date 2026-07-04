import { getMemoryDb } from './sessionStore';
import { getSoul, seedFixedCore, updateEvolving } from './soulStore';
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
  if (neverSeeded) {
    // One-time migration: copy core_memory verbatim into the evolving section.
    // A direct write (not updateEvolving) — no audit row for a migration, and
    // the neverSeeded guard above makes this idempotent across restarts.
    const core = getCore();
    db.prepare(
      'UPDATE soul SET evolving_self = ?, evolving_bond = ?, updated_ms = ? WHERE id = 1',
    ).run(core.self_state, core.relationship_status, Date.now());
  }
  // v0.30.2: one-time purge of the migrated relationship_status fact-ledger (the audited
  // contamination). Idempotent + safe (below). The new dream cleanup-trigger prompt is the general
  // backstop; this handles the known signature immediately + restore-ably.
  cleanEvolvingBond();
}

// The audited ledger markers (2026-07-04 snapshot of relationship_status). A sentence carrying one
// of these is a fact/feature ledger, not a felt bond — the facts already live in L3, so dropping
// the sentence loses nothing. Deliberately SPECIFIC (not generic feature-word matching) to avoid
// over-cleaning a genuine relational sentence.
const LEDGER_MARKERS = ['ships what i name', 'mains ', 'weather feed', 'skill shelf'];

// Sentence-level strip: keep every sentence EXCEPT those carrying a ledger marker. Conservative +
// deterministic + idempotent (once a ledgered sentence is removed, its marker is gone).
export function stripLedger(bond: string): string {
  if (bond.trim().length === 0) return bond.trim();
  const sentences = bond.split(/(?<=[.!?…])\s+/);
  const kept = sentences.filter((sn) => {
    const low = sn.toLowerCase();
    return !LEDGER_MARKERS.some((m) => low.includes(m));
  });
  return kept.join(' ').trim();
}

// One-time evolving-bond purge. Guarded by a 'migration-clean' audit row (written only when it
// actually cleans), so it fires at most once and is a no-op thereafter. Two safety rails: it never
// writes an unchanged field (no spurious audit row), and it never BLANKS the bond — if the strip
// would empty it (a run-on with no sentence breaks), it leaves the field for the dream cleanup
// trigger instead of deleting her self-authored prose. The write audits, so restoreEvolving(1) undoes it.
export function cleanEvolvingBond(): void {
  const db = getMemoryDb();
  if (!db) return;
  const alreadyRan = db
    .prepare("SELECT 1 FROM soul_audit WHERE source = 'migration-clean' LIMIT 1")
    .get();
  if (alreadyRan) return;
  const bond = getSoul().evolving_bond;
  const cleaned = stripLedger(bond);
  if (cleaned === bond.trim() || cleaned.length === 0) return; // nothing to clean, or would over-clean
  updateEvolving({ bond: cleaned }, 'migration-clean');
}
