import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import { migrate } from '../sql';
import { setMemoryDb } from './sessionStore';
import { getSoul, restoreEvolving, seedFixedCore, updateEvolving } from './soulStore';
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

describe('seedFixedCore (hash-gated)', () => {
  test('same text twice → exactly one write; different text → a second write', () => {
    seedFixedCore('fixed core v1');
    const first = getSoul();
    expect(first.fixed_text).toBe('fixed core v1');
    const updatedAfterFirst = first.updated_ms;

    seedFixedCore('fixed core v1'); // unchanged — must be a no-op
    const second = getSoul();
    expect(second.updated_ms).toBe(updatedAfterFirst); // no write happened

    seedFixedCore('fixed core v2'); // changed — must write
    const third = getSoul();
    expect(third.fixed_text).toBe('fixed core v2');
    expect(third.updated_ms).toBeGreaterThanOrEqual(updatedAfterFirst);
  });

  test('no epoch bump on the no-op path; a real change bumps it', () => {
    seedFixedCore('fixed core v1');
    const epochAfterFirst = memoryEpoch();
    seedFixedCore('fixed core v1');
    expect(memoryEpoch()).toBe(epochAfterFirst); // no-op — no bump
    seedFixedCore('fixed core v2');
    expect(memoryEpoch()).toBe(epochAfterFirst + 1); // real change — exactly one bump
  });

  test('preserves the evolving section untouched when the fixed core changes', () => {
    updateEvolving({ self: 'I am becoming', bond: 'close' }, 'test');
    seedFixedCore('fixed core v1');
    seedFixedCore('fixed core v2'); // a real change
    const soul = getSoul();
    expect(soul.fixed_text).toBe('fixed core v2');
    expect(soul.evolving_self).toBe('I am becoming');
    expect(soul.evolving_bond).toBe('close');
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
