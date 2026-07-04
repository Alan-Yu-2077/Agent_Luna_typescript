import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import { migrate } from '../sql';
import { setMemoryDb } from './sessionStore';
import {
  getSoul,
  restoreEvolving,
  seedFixedCore,
  updateEvolving,
  updateFixedCore,
} from './soulStore';
import { memoryEpoch } from './epoch';

let db: Database;

beforeEach(() => {
  db = new Database(':memory:', { strict: true });
  migrate(db, join(import.meta.dir, '..', 'migrations'));
  setMemoryDb(db);
});

afterEach(() => {
  setMemoryDb(null);
  db.close(false);
});

describe('soul migration', () => {
  test('creates soul + soul_audit; getSoul() returns EMPTY on a fresh db', () => {
    expect(getSoul()).toEqual({
      fixed_text: '',
      evolving_self: '',
      evolving_bond: '',
      updated_ms: 0,
    });
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('soul', 'soul_audit')")
      .all() as { name: string }[];
    expect(tables.map((t) => t.name).sort()).toEqual(['soul', 'soul_audit']);
  });
});

describe('seedFixedCore (seed-if-empty, v0.31.0)', () => {
  test('seeds an empty soul once; a later seed with different text is a no-op (owner owns it)', () => {
    seedFixedCore('fixed core v1');
    const first = getSoul();
    expect(first.fixed_text).toBe('fixed core v1');
    const updatedAfterFirst = first.updated_ms;

    seedFixedCore('fixed core v1'); // already owned — no-op
    expect(getSoul().updated_ms).toBe(updatedAfterFirst);

    seedFixedCore('fixed core v2'); // the file changed, but the DB owns it now — MUST NOT clobber
    const after = getSoul();
    expect(after.fixed_text).toBe('fixed core v1');
    expect(after.updated_ms).toBe(updatedAfterFirst);
  });

  test('bumps the epoch on the first seed, then never again', () => {
    const before = memoryEpoch();
    seedFixedCore('fixed core v1');
    expect(memoryEpoch()).toBe(before + 1); // first seed — one bump
    seedFixedCore('fixed core v1');
    seedFixedCore('fixed core v2');
    expect(memoryEpoch()).toBe(before + 1); // owned — no further bump
  });

  test('still seeds the fixed core when the evolving section exists but fixed is empty', () => {
    updateEvolving({ self: 'I am becoming', bond: 'close' }, 'test');
    seedFixedCore('fixed core v1'); // fixed was empty → seed fills it
    const soul = getSoul();
    expect(soul.fixed_text).toBe('fixed core v1');
    expect(soul.evolving_self).toBe('I am becoming');
    expect(soul.evolving_bond).toBe('close');
  });
});

describe('updateFixedCore (owner edit, v0.31.0)', () => {
  test('writes the fixed core + bumps the epoch; identical text is a no-op', () => {
    seedFixedCore('seed core');
    const epochAfterSeed = memoryEpoch();
    updateFixedCore('seed core'); // identical — no-op
    expect(memoryEpoch()).toBe(epochAfterSeed);
    const changed = updateFixedCore('owner-authored core');
    expect(changed?.fixed_text).toBe('owner-authored core');
    expect(getSoul().fixed_text).toBe('owner-authored core');
    expect(memoryEpoch()).toBe(epochAfterSeed + 1); // one bump on a real change
  });

  test('preserves the evolving section', () => {
    updateEvolving({ self: 'restless', bond: 'trusting' }, 'dream');
    updateFixedCore('owner core');
    const soul = getSoul();
    expect(soul.fixed_text).toBe('owner core');
    expect(soul.evolving_self).toBe('restless');
    expect(soul.evolving_bond).toBe('trusting');
  });

  test('an owner edit survives a subsequent boot seed — the core is no longer "固定死"', () => {
    updateFixedCore('my customized core');
    seedFixedCore('the git default.md text'); // next boot — must NOT overwrite the owner edit
    expect(getSoul().fixed_text).toBe('my customized core');
  });
});

describe('updateEvolving (ported from coreMemory.updateCore)', () => {
  test('audit-first: writes a soul_audit row carrying the prior state', () => {
    updateEvolving({ self: 'v1 self', bond: 'v1 bond' }, 'dream');
    updateEvolving({ self: 'v2 self' }, 'dream');
    const rows = db
      .prepare('SELECT prev_self, prev_bond, source FROM soul_audit ORDER BY id')
      .all() as { prev_self: string; prev_bond: string; source: string }[];
    expect(rows.length).toBe(2);
    expect(rows[1]).toEqual({ prev_self: 'v1 self', prev_bond: 'v1 bond', source: 'dream' });
  });

  test('byte-identical patch is a no-op: no audit row, no epoch bump', () => {
    updateEvolving({ self: 'calm', bond: 'close' }, 'dream');
    const auditCount = () =>
      (db.prepare('SELECT COUNT(*) c FROM soul_audit').get() as { c: number }).c;
    const before = auditCount();
    const epochBefore = memoryEpoch();
    const result = updateEvolving({ self: 'calm', bond: 'close' }, 'dream');
    expect(auditCount()).toBe(before);
    expect(memoryEpoch()).toBe(epochBefore);
    expect(result?.evolving_self).toBe('calm');
  });

  test('a real change bumps the epoch exactly once', () => {
    updateEvolving({ self: 'calm', bond: 'close' }, 'dream');
    const epochBefore = memoryEpoch();
    updateEvolving({ self: 'restless' }, 'dream');
    expect(memoryEpoch()).toBe(epochBefore + 1);
  });
});

describe('restoreEvolving', () => {
  test('walks back one step via the audit trail', () => {
    updateEvolving({ self: 'v1 self', bond: 'v1 bond' }, 'dream');
    updateEvolving({ self: 'v2 self', bond: 'v2 bond' }, 'dream');
    const restored = restoreEvolving(1);
    expect(restored?.evolving_self).toBe('v1 self');
    expect(restored?.evolving_bond).toBe('v1 bond');
  });
});
