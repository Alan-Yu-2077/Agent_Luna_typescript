import { getMemoryDb } from './sessionStore';
import { getSoul, seedFixedCore, updateEvolving } from './soulStore';
import { loadPersona } from '../persona/loader';

// Boot-time seed for the soul substrate (Initiative 22). Seeds the fixed core from the persona file
// (hash-gated no-op when unchanged) and runs the one-time evolving-bond purge. v0.30.3: the
// core_memory → evolving migration moved into migration 0017 (which also drops the table), so this
// no longer reads core_memory — by boot time (seedSoulOnBoot runs after migrate) it is already gone.
export function seedSoulOnBoot(): void {
  const db = getMemoryDb();
  if (!db) return;
  seedFixedCore(loadPersona().text);
  // v0.30.2: one-time purge of the migrated relationship_status fact-ledger (the audited
  // contamination). Idempotent + safe (below). The dream cleanup-trigger prompt is the general
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
