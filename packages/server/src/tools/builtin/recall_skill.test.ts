import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import { migrate } from '../../sql';
import { setMemoryDb } from '../../memory/sessionStore';
import { getSkill, saveSkill } from '../../skills/skillStore';
import { recallSkillTool, type RecallSkillOutput } from './recall_skill';

let db: Database;

const ctx = () => ({
  sessionId: 'test',
  callId: 'c1',
  abortSignal: new AbortController().signal,
});

async function run(input: unknown): Promise<{ kind: string; data?: RecallSkillOutput }> {
  const events: unknown[] = [];
  for await (const e of recallSkillTool.execute(input, ctx())) events.push(e);
  return events[0] as { kind: string; data?: RecallSkillOutput };
}

describe('recall_skill usage tracking (v0.32.1)', () => {
  beforeEach(() => {
    db = new Database(':memory:', { strict: true });
    migrate(db, join(import.meta.dir, '..', '..', 'migrations'));
    setMemoryDb(db);
  });
  afterEach(() => {
    setMemoryDb(null);
    db.close(false);
  });

  test('a hit bumps used_count + last_used_ms for each returned skill', async () => {
    saveSkill({ name: 'deploy-check', description: 'verify a deploy', body: 'b' }, 1000);
    const res = await run({ query: 'deploy' });
    expect(res.kind).toBe('ok');
    expect(res.data?.count).toBe(1);
    const s = getSkill('deploy-check')!;
    expect(s.used_count).toBe(1);
    expect(s.last_used_ms).toBeGreaterThan(0);
  });

  test('a miss records nothing', async () => {
    saveSkill({ name: 'deploy-check', description: 'verify a deploy', body: 'b' }, 1000);
    const res = await run({ query: 'zzzz-no-match-乱码词' });
    expect(res.kind).toBe('ok');
    expect(res.data?.count).toBe(0);
    expect(getSkill('deploy-check')!.used_count).toBe(0);
  });
});
