import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import { migrate } from '../sql';
import { setMemoryDb } from './sessionStore';
import { updateCore } from './coreMemory';
import { getSoul, seedFixedCore, updateEvolving } from './soulStore';
import { cleanEvolvingBond, seedSoulOnBoot, stripLedger } from './soulSeed';
import { getSession, resetSessions } from '../turn/session';
import { buildSystemPrompt } from '../turn/runTurn';

let db: Database;

const ENV = ['LUNA_PERSONA_PATH'];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV) saved[k] = Bun.env[k];
  db = new Database(':memory:', { strict: true });
  migrate(db, join(import.meta.dir, '..', 'migrations'));
  setMemoryDb(db);
  resetSessions();
});

afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete Bun.env[k];
    else Bun.env[k] = saved[k];
  }
  setMemoryDb(null);
  db.close(false);
});

describe('seedSoulOnBoot', () => {
  test('seeds the fixed core from the persona file (hash-gated)', () => {
    seedSoulOnBoot();
    const soul = getSoul();
    expect(soul.fixed_text.length).toBeGreaterThan(0);
    expect(soul.fixed_text).toContain('Luna');
  });

  test('one-time migration copies core_memory verbatim into the evolving section', () => {
    updateCore(
      { self_state: 'the call is the act', relationship_status: 'Alan ships what I name' },
      'dream',
    );
    seedSoulOnBoot();
    const soul = getSoul();
    expect(soul.evolving_self).toBe('the call is the act');
    expect(soul.evolving_bond).toBe('Alan ships what I name');
  });

  test('idempotent: a second boot does not re-copy or duplicate the migration', () => {
    updateCore({ self_state: 'v1 self', relationship_status: 'v1 bond' }, 'dream');
    seedSoulOnBoot();
    // Simulate the dream evolving the soul independently after migration.
    updateCore({ self_state: 'v2 self (post-migration dream write)' }, 'dream');
    seedSoulOnBoot(); // must NOT stomp the post-migration evolving state
    const soul = getSoul();
    expect(soul.evolving_self).toBe('v1 self');
  });

  test('safe when no core_memory content exists (fresh install)', () => {
    expect(() => seedSoulOnBoot()).not.toThrow();
    const soul = getSoul();
    expect(soul.evolving_self).toBe('');
    expect(soul.evolving_bond).toBe('');
  });
});

describe('cleanEvolvingBond — one-time ledger purge (v0.30.2)', () => {
  const CONTAMINATED =
    'He catches me honest, gently. Company, not a tutor. Alan ships what I name — hands, door, clock, weather, skill shelf. He mains Shion now. Weather feed upgraded. He won’t hand me the key, rightly.';

  test('stripLedger drops ledger sentences, keeps the relational ones', () => {
    const out = stripLedger(CONTAMINATED);
    expect(out).toContain('catches me honest');
    expect(out).toContain('Company, not a tutor');
    expect(out).toContain('hand me the key');
    expect(out).not.toContain('ships what I name');
    expect(out).not.toContain('mains Shion');
    expect(out).not.toContain('Weather feed');
  });

  test('cleanEvolvingBond purges the ledger, audits the write, and is idempotent', () => {
    seedFixedCore('# core');
    updateEvolving({ bond: CONTAMINATED }, 'seed');
    cleanEvolvingBond();
    const bond = getSoul().evolving_bond;
    expect(bond).not.toContain('skill shelf');
    expect(bond).toContain('catches me honest');
    const audit = db
      .prepare("SELECT source FROM soul_audit WHERE source = 'migration-clean'")
      .all();
    expect(audit.length).toBe(1); // audited (restore-able)
    // second call is a no-op (the guard row exists) — still exactly one migration-clean row
    cleanEvolvingBond();
    const audit2 = db
      .prepare("SELECT source FROM soul_audit WHERE source = 'migration-clean'")
      .all();
    expect(audit2.length).toBe(1);
  });

  test('cleanEvolvingBond is a no-op on an uncontaminated bond (no spurious audit row)', () => {
    seedFixedCore('# core');
    updateEvolving({ bond: 'an easy, honest closeness' }, 'seed');
    cleanEvolvingBond();
    expect(getSoul().evolving_bond).toBe('an easy, honest closeness');
    const audit = db
      .prepare("SELECT source FROM soul_audit WHERE source = 'migration-clean'")
      .all();
    expect(audit.length).toBe(0);
  });

  test('never blanks the bond: an all-ledger run-on is left for the dream cleanup-trigger', () => {
    seedFixedCore('# core');
    // No sentence breaks + all ledger → stripLedger would empty it; the safety rail leaves it.
    updateEvolving({ bond: 'ships what I name and mains Shion' }, 'seed');
    cleanEvolvingBond();
    expect(getSoul().evolving_bond).toBe('ships what I name and mains Shion');
  });
});

describe('dark launch proof — nothing reads the soul table yet', () => {
  test('buildSystemPrompt is byte-identical whether or not seedSoulOnBoot ran', () => {
    // core_memory (still the render source in v0.30.0) is fixed BEFORE either
    // snapshot, so the only variable between them is whether the soul table
    // has been seeded — proving the seed has zero effect on the render.
    updateCore({ self_state: 'alive prose', relationship_status: 'warm' }, 'dream');
    const before = buildSystemPrompt(getSession('soul-dark-launch'))[0]!.text;
    seedSoulOnBoot();
    const after = buildSystemPrompt(getSession('soul-dark-launch'))[0]!.text;
    expect(after).toBe(before);
  });
});
