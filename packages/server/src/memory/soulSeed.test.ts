import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import { migrate } from '../sql';
import { setMemoryDb } from './sessionStore';
import { updateCore } from './coreMemory';
import { getSoul } from './soulStore';
import { seedSoulOnBoot } from './soulSeed';
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
