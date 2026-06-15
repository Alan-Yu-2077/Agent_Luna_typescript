import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import { migrate } from '../../sql';
import { setMemoryDb } from '../../memory/sessionStore';
import { getSkill } from '../../skills/skillStore';
import { setSpawnerForTests } from '../shellCore';
import { skillsEnabled, withSkills } from '../registry';
import { saveSkillTool } from './save_skill';
import { recallSkillTool } from './recall_skill';

const ctx = () => ({ sessionId: 't', callId: 'c', abortSignal: new AbortController().signal });

async function run(
  tool: typeof saveSkillTool | typeof recallSkillTool,
  input: unknown,
): Promise<{ kind: string; data?: Record<string, unknown> }> {
  const events: unknown[] = [];
  for await (const e of tool.execute(input as never, ctx())) events.push(e);
  return events[0] as { kind: string; data?: Record<string, unknown> };
}

const passSpawn = async () => ({ stdout: ' 10 pass\n 0 fail', stderr: '', exitCode: 0, timedOut: false });
const failSpawn = async () => ({ stdout: ' 3 pass\n 2 fail\n(fail) suite > x [1ms]', stderr: '', exitCode: 1, timedOut: false });

describe('save_skill / recall_skill', () => {
  beforeEach(() => {
    const db = new Database(':memory:');
    migrate(db, join(import.meta.dir, '..', '..', 'migrations'));
    setMemoryDb(db);
  });
  afterEach(() => {
    setMemoryDb(null);
    setSpawnerForTests(null);
  });

  test('refuses to persist when the verify loop fails', async () => {
    setSpawnerForTests(failSpawn);
    const e = await run(saveSkillTool, { name: 's', description: 'd', body: 'b' });
    expect(e.kind).toBe('ok');
    expect(e.data?.['saved']).toBe(false);
    expect(e.data?.['verified']).toBe(false);
    expect(e.data?.['fail']).toBe(2);
    expect(getSkill('s')).toBeNull(); // nothing entered the library
  });

  test('persists when verify passes, and recall_skill finds it', async () => {
    setSpawnerForTests(passSpawn);
    const e = await run(saveSkillTool, { name: 'deploy', description: 'how to ship a release', body: 'steps...' });
    expect(e.data?.['saved']).toBe(true);
    expect(e.data?.['verified']).toBe(true);

    const r = await run(recallSkillTool, { query: 'how to ship a release' });
    const names = (r.data?.['skills'] as { name: string }[]).map((s) => s.name);
    expect(names).toContain('deploy');
  });

  test('verify:false saves without running the suite', async () => {
    setSpawnerForTests(async () => {
      throw new Error('spawner must not run when verify:false');
    });
    const e = await run(saveSkillTool, { name: 'note', description: 'a knowledge note', body: 'x', verify: false });
    expect(e.data?.['saved']).toBe(true);
    expect(getSkill('note')).not.toBeNull();
  });

  test('LUNA_SKILLS=0 leaves both skill tools out of the registry', () => {
    const prev = Bun.env['LUNA_SKILLS'];
    Bun.env['LUNA_SKILLS'] = '0';
    try {
      expect(skillsEnabled()).toBe(false);
      const reg = withSkills({});
      expect(reg.save_skill).toBeUndefined();
      expect(reg.recall_skill).toBeUndefined();
    } finally {
      if (prev === undefined) delete Bun.env['LUNA_SKILLS'];
      else Bun.env['LUNA_SKILLS'] = prev;
    }
  });
});
