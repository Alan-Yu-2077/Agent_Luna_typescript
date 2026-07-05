import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import { migrate } from '../sql';
import { getMemoryDb, setMemoryDb } from '../memory/sessionStore';
import { memoryEpoch } from '../memory/epoch';
import {
  deprecateSkill,
  getSkill,
  listShelf,
  listSkills,
  markUsed,
  restoreSkill,
  saveSkill,
  searchSkills,
} from './skillStore';

function auditRows(name?: string): Array<{ name: string; prev_body: string; source: string }> {
  const db = getMemoryDb()!;
  const sql = name
    ? 'SELECT name, prev_body, source FROM skills_audit WHERE name = ? ORDER BY id'
    : 'SELECT name, prev_body, source FROM skills_audit ORDER BY id';
  return (name ? db.prepare(sql).all(name) : db.prepare(sql).all()) as Array<{
    name: string;
    prev_body: string;
    source: string;
  }>;
}

describe('skillStore', () => {
  beforeEach(() => {
    const db = new Database(':memory:');
    migrate(db, join(import.meta.dir, '..', 'migrations'));
    setMemoryDb(db);
  });
  afterEach(() => setMemoryDb(null));

  test('save + get round-trips; update preserves created_ms, bumps verified_ms', () => {
    expect(saveSkill({ name: 'deploy', description: 'how to deploy', body: 'step 1' }, 1000)).toBe(true);
    const s = getSkill('deploy');
    expect(s?.body).toBe('step 1');
    expect(s?.created_ms).toBe(1000);

    saveSkill({ name: 'deploy', description: 'how to deploy v2', body: 'step 1 revised' }, 2000);
    const s2 = getSkill('deploy');
    expect(s2?.created_ms).toBe(1000); // preserved
    expect(s2?.verified_ms).toBe(2000); // bumped
    expect(s2?.body).toBe('step 1 revised');
  });

  test('listSkills orders by verified_ms desc', () => {
    saveSkill({ name: 'a', description: 'aaa', body: 'x' }, 1000);
    saveSkill({ name: 'b', description: 'bbb', body: 'y' }, 3000);
    saveSkill({ name: 'c', description: 'ccc', body: 'z' }, 2000);
    expect(listSkills().map((s) => s.name)).toEqual(['b', 'c', 'a']);
  });

  test('searchSkills ranks the matching skill first', () => {
    saveSkill({ name: 'deploy', description: 'release the build to production', body: '...' }, 1000);
    saveSkill({ name: 'lint', description: 'run prettier over the tree', body: '...' }, 1000);
    const hits = searchSkills('how do I release to production', 5);
    expect(hits.map((h) => h.name)).toContain('deploy');
    expect(hits[0]?.name).toBe('deploy');
  });

  test('no DB → save returns false, reads return empty', () => {
    setMemoryDb(null);
    expect(saveSkill({ name: 'x', description: 'y', body: 'z' }, 1)).toBe(false);
    expect(listSkills()).toEqual([]);
    expect(getSkill('x')).toBeNull();
  });
});

describe('skillStore lifecycle (v0.32.0)', () => {
  beforeEach(() => {
    const db = new Database(':memory:');
    migrate(db, join(import.meta.dir, '..', 'migrations'));
    setMemoryDb(db);
  });
  afterEach(() => setMemoryDb(null));

  test('0018 backfill: a legacy 5-column insert reads with lifecycle defaults', () => {
    getMemoryDb()!
      .prepare(
        'INSERT INTO skills (name, description, body, created_ms, verified_ms) VALUES (?, ?, ?, ?, ?)',
      )
      .run('legacy', 'old row', 'body', 100, 100);
    const s = getSkill('legacy');
    expect(s?.used_count).toBe(0);
    expect(s?.last_used_ms).toBe(0);
    expect(s?.source).toBe('saved');
    expect(s?.deprecated_ms).toBe(0);
  });

  test('audit-first: a fresh insert writes no audit row; an update carries the prior state', () => {
    saveSkill({ name: 'a', description: 'v1 desc', body: 'v1 body' }, 1000);
    expect(auditRows('a')).toEqual([]);
    saveSkill({ name: 'a', description: 'v2 desc', body: 'v2 body' }, 2000);
    const rows = auditRows('a');
    expect(rows.length).toBe(1);
    expect(rows[0]).toEqual({ name: 'a', prev_body: 'v1 body', source: 'saved' });
  });

  test('byte-identical save: verified_ms refreshes (just re-verified) but no audit, no epoch bump', () => {
    saveSkill({ name: 'a', description: 'd', body: 'b' }, 1000);
    const epochBefore = memoryEpoch();
    expect(saveSkill({ name: 'a', description: 'd', body: 'b' }, 2000)).toBe(true);
    expect(memoryEpoch()).toBe(epochBefore); // shelf bytes unchanged — cache invariant holds
    expect(auditRows('a')).toEqual([]);
    expect(getSkill('a')!.verified_ms).toBe(2000); // the verification stamp stays honest
  });

  test('a real change bumps the epoch exactly once and preserves usage counters', () => {
    saveSkill({ name: 'a', description: 'd', body: 'b' }, 1000);
    markUsed('a', 1500);
    markUsed('a', 1600);
    const epochBefore = memoryEpoch();
    saveSkill({ name: 'a', description: 'd', body: 'b improved' }, 2000);
    expect(memoryEpoch()).toBe(epochBefore + 1);
    const s = getSkill('a')!;
    expect(s.used_count).toBe(2); // an improved skill keeps its usage history
    expect(s.last_used_ms).toBe(1600);
  });

  test('markUsed increments + stamps, without epoch bump or audit (under the cap)', () => {
    saveSkill({ name: 'a', description: 'd', body: 'b' }, 1000);
    const epochBefore = memoryEpoch();
    markUsed('a', 5000);
    const s = getSkill('a')!;
    expect(s.used_count).toBe(1);
    expect(s.last_used_ms).toBe(5000);
    expect(memoryEpoch()).toBe(epochBefore);
    expect(auditRows('a')).toEqual([]);
  });

  test('markUsed bumps the epoch exactly when it changes over-cap shelf membership', () => {
    const savedMax = Bun.env['LUNA_SKILL_SHELF_MAX'];
    Bun.env['LUNA_SKILL_SHELF_MAX'] = '2';
    try {
      saveSkill({ name: 'aaa', description: 'd', body: 'b' }, 1000);
      saveSkill({ name: 'bbb', description: 'd', body: 'b' }, 2000);
      saveSkill({ name: 'ccc', description: 'd', body: 'b' }, 3000);
      // all count-0 → name tie-break keeps {aaa,bbb}; these two marks keep that set
      markUsed('aaa', 4000);
      markUsed('bbb', 5000);
      const epochBefore = memoryEpoch();
      markUsed('aaa', 6000); // aaa already on the shelf and stays — membership unchanged
      expect(memoryEpoch()).toBe(epochBefore);
      markUsed('ccc', 7000); // ccc (1 use, newest) evicts bbb (1 use, older) — membership changes
      expect(memoryEpoch()).toBeGreaterThan(epochBefore);
    } finally {
      if (savedMax === undefined) delete Bun.env['LUNA_SKILL_SHELF_MAX'];
      else Bun.env['LUNA_SKILL_SHELF_MAX'] = savedMax;
    }
  });

  test('deprecate hides from listSkills/searchSkills/listShelf, audits, bumps epoch; repeat is a no-op', () => {
    saveSkill({ name: 'a', description: 'release the build', body: 'b' }, 1000);
    const epochBefore = memoryEpoch();
    expect(deprecateSkill('a', 2000, 'owner')).toBe(true);
    expect(memoryEpoch()).toBe(epochBefore + 1);
    expect(listSkills().length).toBe(0);
    expect(searchSkills('release the build').length).toBe(0);
    expect(listShelf(10).length).toBe(0);
    expect(listSkills(50, true).length).toBe(1); // still in the library
    expect(auditRows('a').length).toBe(1);
    expect(deprecateSkill('a', 3000, 'owner')).toBe(false); // already deprecated — no-op
    expect(auditRows('a').length).toBe(1);
  });

  test('restore undoes a deprecation (back on the shelf)', () => {
    saveSkill({ name: 'a', description: 'd', body: 'b' }, 1000);
    deprecateSkill('a', 2000, 'dream');
    const restored = restoreSkill('a', 3000);
    expect(restored?.deprecated_ms).toBe(0);
    expect(listShelf(10).map((s) => s.name)).toEqual(['a']);
  });

  test('restore undoes an overwrite (prior body + its own verified_ms back; the replaced state audited)', () => {
    saveSkill({ name: 'a', description: 'v1 desc', body: 'v1 body' }, 1000);
    saveSkill({ name: 'a', description: 'v2 desc', body: 'v2 body' }, 2000);
    const restored = restoreSkill('a', 3000);
    expect(restored?.body).toBe('v1 body');
    expect(restored?.description).toBe('v1 desc');
    expect(restored?.verified_ms).toBe(1000); // v1 wears ITS verification stamp, not v2's
    const rows = auditRows('a');
    expect(rows.map((r) => r.source)).toEqual(['saved', 'restore']);
    expect(rows[1]?.prev_body).toBe('v2 body'); // the restore audited the state it replaced
  });

  test('restores chain as undo/redo: a second restore brings the overwrite back', () => {
    saveSkill({ name: 'a', description: 'v1', body: 'v1 body' }, 1000);
    saveSkill({ name: 'a', description: 'v2', body: 'v2 body' }, 2000);
    expect(restoreSkill('a', 3000)?.body).toBe('v1 body'); // undo
    expect(restoreSkill('a', 4000)?.body).toBe('v2 body'); // redo (undoes the restore)
    expect(restoreSkill('a', 5000)?.body).toBe('v1 body'); // toggles
  });

  test('restore is no-op-guarded: a prior state identical to the current writes nothing', () => {
    saveSkill({ name: 'a', description: 'd', body: 'b' }, 1000);
    const cur = getSkill('a')!;
    // degenerate audit row whose prior state equals the current state
    getMemoryDb()!
      .prepare(
        `INSERT INTO skills_audit (t_ms, name, prev_description, prev_body, prev_source, prev_verified_ms, prev_deprecated_ms, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(1500, 'a', cur.description, cur.body, cur.source, cur.verified_ms, cur.deprecated_ms, 'owner');
    const epochBefore = memoryEpoch();
    const auditCountBefore = auditRows('a').length;
    expect(restoreSkill('a', 2000)?.body).toBe('b');
    expect(memoryEpoch()).toBe(epochBefore); // no bump on zero change
    expect(auditRows('a').length).toBe(auditCountBefore); // no junk audit row
  });

  test('saving a deprecated skill revives it', () => {
    saveSkill({ name: 'a', description: 'd', body: 'b' }, 1000);
    deprecateSkill('a', 2000, 'owner');
    saveSkill({ name: 'a', description: 'd2', body: 'b2' }, 3000);
    expect(getSkill('a')!.deprecated_ms).toBe(0);
    expect(listShelf(10).length).toBe(1);
  });

  test('listShelf: name-ordered under the cap; over the cap the most-used survive, then name-order', () => {
    saveSkill({ name: 'zeta', description: 'z', body: 'b' }, 1000);
    saveSkill({ name: 'alpha', description: 'a', body: 'b' }, 2000);
    saveSkill({ name: 'mid', description: 'm', body: 'b' }, 3000);
    expect(listShelf(10).map((s) => s.name)).toEqual(['alpha', 'mid', 'zeta']);
    markUsed('zeta', 4000);
    markUsed('zeta', 5000);
    markUsed('mid', 6000);
    expect(listShelf(2).map((s) => s.name)).toEqual(['mid', 'zeta']); // top-used, then name-sorted
  });

  test('provenance: source lands on the row and in the audit actor', () => {
    saveSkill({ name: 'a', description: 'd', body: 'b' }, 1000, 'dream');
    expect(getSkill('a')!.source).toBe('dream');
    saveSkill({ name: 'a', description: 'd', body: 'b2' }, 2000, 'owner');
    expect(getSkill('a')!.source).toBe('owner');
    expect(auditRows('a')[0]?.source).toBe('owner'); // the actor that overwrote v1
  });

  test('saveSkill single-lines name + description at the write choke point (injection defense)', () => {
    saveSkill({ name: ' multi\nline ', description: 'a\n\n## forged\nheading', body: 'body\nkeeps\nnewlines' }, 1000);
    const s = getSkill('multi line')!;
    expect(s.description).toBe('a ## forged heading');
    expect(s.body).toBe('body\nkeeps\nnewlines'); // the body is a data channel, untouched
  });

  test('no DB → lifecycle calls degrade to no-ops', () => {
    setMemoryDb(null);
    expect(deprecateSkill('x', 1, 'owner')).toBe(false);
    expect(restoreSkill('x', 1)).toBeNull();
    expect(listShelf(10)).toEqual([]);
    markUsed('x', 1); // must not throw
  });
});
