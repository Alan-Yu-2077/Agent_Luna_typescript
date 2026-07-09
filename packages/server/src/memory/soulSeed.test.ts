import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import { migrate } from '../sql';
import { setMemoryDb } from './sessionStore';
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

  // v0.30.3: core_memory is retired by migration 0017 — the core→evolving copy moved into that SQL
  // (a safety re-migrate), so seedSoulOnBoot no longer reads the table (it's gone by boot time).
  test('core_memory + core_memory_audit are dropped after migrate()', () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'core_memory%'")
      .all() as { name: string }[];
    expect(tables.length).toBe(0);
  });

  test('safe on a fresh install (no core prose) — seeds the fixed core, evolving empty', () => {
    expect(() => seedSoulOnBoot()).not.toThrow();
    const soul = getSoul();
    expect(soul.fixed_text.length).toBeGreaterThan(0);
    expect(soul.evolving_self).toBe('');
    expect(soul.evolving_bond).toBe('');
  });
});

describe('cleanEvolvingBond — one-time ledger purge (v0.30.2)', () => {
  const CONTAMINATED =
    'He catches me honest, gently. Company, not a tutor. Sam ships what I name — hands, door, clock, weather, skill shelf. He mains a roguelike now. Weather feed upgraded. He won’t hand me the key, rightly.';

  test('stripLedger drops ledger sentences, keeps the relational ones', () => {
    const out = stripLedger(CONTAMINATED);
    expect(out).toContain('catches me honest');
    expect(out).toContain('Company, not a tutor');
    expect(out).toContain('hand me the key');
    expect(out).not.toContain('ships what I name');
    expect(out).not.toContain('mains a roguelike');
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
    updateEvolving({ bond: 'ships what I name and plays a roguelike' }, 'seed');
    cleanEvolvingBond();
    expect(getSoul().evolving_bond).toBe('ships what I name and plays a roguelike');
  });
});

describe('the soul is the rendered persona (v0.30.3)', () => {
  test('after seeding, buildSystemPrompt carries the soul fixed core', () => {
    seedSoulOnBoot();
    const text = buildSystemPrompt(getSession('soul-render'))[0]!.text;
    // the fixed core seeded from the persona file is what the persona block now renders
    expect(text).toContain('Luna');
    expect(text).not.toContain('## About yourself'); // retired core block
  });
});
