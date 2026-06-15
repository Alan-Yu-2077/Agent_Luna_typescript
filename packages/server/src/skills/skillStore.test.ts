import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import { migrate } from '../sql';
import { setMemoryDb } from '../memory/sessionStore';
import { getSkill, listSkills, saveSkill, searchSkills } from './skillStore';

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
