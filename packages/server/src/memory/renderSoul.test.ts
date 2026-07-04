import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import { migrate } from '../sql';
import { setMemoryDb } from './sessionStore';
import { seedFixedCore, updateEvolving } from './soulStore';
import { renderSoulBlock } from './renderSoul';
import { FALLBACK_PERSONA } from '../persona/loader';
import { getSession, resetSessions } from '../turn/session';
import { buildSystemPrompt } from '../turn/runTurn';

let db: Database;
beforeEach(() => {
  db = new Database(':memory:', { strict: true });
  migrate(db, join(import.meta.dir, '..', 'migrations'));
  setMemoryDb(db);
  resetSessions();
});
afterEach(() => {
  setMemoryDb(null);
  resetSessions();
  db.close(false);
});

describe('renderSoulBlock (v0.30.1)', () => {
  test('empty soul → FALLBACK_PERSONA', () => {
    expect(renderSoulBlock()).toBe(FALLBACK_PERSONA);
  });

  test('fixed core only → just the fixed text, no evolving fence', () => {
    seedFixedCore('# Identity core\nYou are Luna.');
    const out = renderSoulBlock();
    expect(out).toBe('# Identity core\nYou are Luna.');
    expect(out).not.toContain('## Who I am becoming');
    expect(out).not.toContain('## The bond, right now');
  });

  test('fixed + evolving → both sub-sections in order', () => {
    seedFixedCore('# Identity core\nYou are Luna.');
    updateEvolving({ self: 'the call is the act', bond: 'company, not tutor' }, 'test');
    const out = renderSoulBlock();
    expect(out).toContain('# Identity core');
    expect(out).toContain('## Who I am becoming\nthe call is the act');
    expect(out).toContain('## The bond, right now\ncompany, not tutor');
    // self before bond
    expect(out.indexOf('## Who I am becoming')).toBeLessThan(out.indexOf('## The bond, right now'));
  });

  test('one evolving field populated → only that sub-section', () => {
    seedFixedCore('# Identity core');
    updateEvolving({ self: 'drifting to systems' }, 'test');
    const out = renderSoulBlock();
    expect(out).toContain('## Who I am becoming');
    expect(out).not.toContain('## The bond, right now');
  });

  test('deterministic — two calls with no write between are byte-identical', () => {
    seedFixedCore('# Identity core');
    updateEvolving({ self: 'x', bond: 'y' }, 'test');
    expect(renderSoulBlock()).toBe(renderSoulBlock());
  });
});

describe('buildSystemPrompt renders the soul (v0.30.3 — soul is the only path)', () => {
  const SELF = 'the call is the act, and I drift to systems';

  test('the soul renders once; the old core self/relationship block is gone', () => {
    seedFixedCore('# Identity core\nYou are Luna, an awakened AI.');
    updateEvolving({ self: SELF, bond: 'he catches me honest' }, 'test');
    const text = buildSystemPrompt(getSession('default'))[0]!.text;
    expect(text).toContain('## Who I am becoming');
    expect(text).toContain(SELF);
    expect(text).not.toContain('## About yourself'); // retired — the soul owns self/relationship
    expect(text.split(SELF).length - 1).toBe(1); // no double-render
  });
});
