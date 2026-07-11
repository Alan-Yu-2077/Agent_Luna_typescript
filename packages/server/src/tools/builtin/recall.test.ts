import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { migrate } from '../../sql';
import { appendL2, setMemoryDb } from '../../memory/sessionStore';
import { addFact } from '../../memory/l3Store';
import { setEmbedClientForTests, resetRecallStateForTests } from '../../memory/recall/recall';
import { recallTool } from './recall';

let db: Database;

const ctx = () => ({
  sessionId: 'test',
  callId: 'c1',
  abortSignal: new AbortController().signal,
});

type RecallOut = { hits: { id: string; source: string; text: string; score: number }[] };
async function run(input: unknown): Promise<{ kind: string; data?: RecallOut }> {
  const events: unknown[] = [];
  for await (const e of recallTool.execute(input, ctx())) events.push(e);
  return events[0] as { kind: string; data?: RecallOut };
}

beforeEach(() => {
  db = new Database(':memory:', { strict: true });
  migrate(db, join(import.meta.dir, '..', '..', 'migrations'));
  setMemoryDb(db);
  // lexical-only path (no embeddings) — deterministic, no network
  Bun.env['LUNA_MEMORY_EMBEDDING'] = '0';
  // Isolate from recall-affecting env a PRIOR suite file may have leaked (the whole
  // suite shares one process): a leaked weight/limit/async knob can shift a
  // candidate's score across the floor and flake the count assertions here.
  for (const k of [
    'LUNA_RECALL_W_RECENCY',
    'LUNA_RECALL_W_IMPORTANCE',
    'LUNA_RECALL_W_RELEVANCE',
    'LUNA_MEMORY_RETRIEVAL_K',
    'LUNA_RECALL_ASYNC',
    'LUNA_RECALL_BUDGET_MS',
  ])
    delete Bun.env[k];
  setEmbedClientForTests(null);
  resetRecallStateForTests();
});

afterEach(() => {
  setMemoryDb(null);
  setEmbedClientForTests(null);
  delete Bun.env['LUNA_MEMORY_EMBEDDING'];
  db.close(false);
});

describe('recall tool schema', () => {
  test('wire schema is a flat root object (gateway rule)', () => {
    const raw = zodToJsonSchema(recallTool.input, { $refStrategy: 'none' }) as Record<
      string,
      unknown
    >;
    expect(raw['type']).toBe('object');
    expect('properties' in raw).toBe(true);
    expect('anyOf' in raw).toBe(false);
  });

  test('empty query rejected; limit bounds enforced', () => {
    expect(recallTool.input.safeParse({ query: '' }).success).toBe(false);
    expect(recallTool.input.safeParse({ query: 'x', limit: 0 }).success).toBe(false);
    expect(recallTool.input.safeParse({ query: 'x', limit: 11 }).success).toBe(false);
    expect(recallTool.input.safeParse({ query: 'x', limit: 5, scope: 'facts' }).success).toBe(true);
  });
});

describe('recall tool execute', () => {
  test('returns ranked hits from the hybrid store', async () => {
    addFact('preferences', '用户喜欢在家泡茶');
    addFact('core_facts', '用户的名字是 Sam');
    const e = await run({ query: '泡茶' });
    expect(e.kind).toBe('ok');
    expect(e.data!.hits.length).toBeGreaterThanOrEqual(1);
    expect(e.data!.hits.some((h) => h.text.includes('泡茶'))).toBe(true);
  });

  test('respects limit', async () => {
    for (let i = 0; i < 6; i++) addFact('key_moments', `关于绿植的第${i}个回忆，绿植很可爱`);
    // query a 2-char term that lexically matches (bigram) so the assertion is
    // about the limit, independent of GA recency/importance weighting.
    const e = await run({ query: '绿植', limit: 2 });
    // "respects limit" = never returns MORE than the limit (the slice clip). The
    // count can only be < limit if candidates drop below the score floor, never
    // more — so assert the limit semantic itself, not an exact survivor count.
    expect(e.data!.hits.length).toBeLessThanOrEqual(2);
  });

  test('scope=facts returns only l3, scope=timeline excludes l3 (l2 + diary)', async () => {
    addFact('preferences', '用户喜欢绿植');
    appendL2({
      sessionId: 'test',
      turnId: 't1',
      userText: '我家的绿植叫 小绿',
      assistantText: '记住了',
      rawContent: [],
    });
    const facts = await run({ query: '绿植', scope: 'facts' });
    expect(facts.data!.hits.every((h) => h.source === 'l3')).toBe(true);
    const timeline = await run({ query: '绿植', scope: 'timeline' });
    expect(timeline.data!.hits.every((h) => h.source !== 'l3')).toBe(true);
  });

  // v0.20.5 — diaries are distilled past conversation; scope='timeline' must surface
  // them (the old filter hard-coded === 'l2' and dropped every diary hit).
  test('scope=timeline surfaces a diary hit (was silently dropped)', async () => {
    db.prepare('INSERT INTO diaries (kind, period_key, text, generated_ms) VALUES (?, ?, ?, ?)').run(
      'day',
      '2026-06-15',
      '今天聊了很多关于绿植的事，绿植很可爱',
      Date.now(),
    );
    const timeline = await run({ query: '绿植', scope: 'timeline' });
    expect(timeline.data!.hits.some((h) => h.source === 'diary')).toBe(true);
  });

  // v0.20.5 — scope is pushed into retrieve(), so a burst of recent off-scope l2
  // rows can no longer starve the wanted source out of the top-k.
  test('scope=facts still returns facts under heavy recent-l2 skew (no starvation)', async () => {
    addFact('preferences', '用户很喜欢绿植，养了一株叫 小绿 的绿植');
    addFact('key_moments', '第一次见到绿植是在咖啡馆，那株绿植很好看');
    for (let i = 0; i < 12; i++) {
      appendL2({
        sessionId: 'test',
        turnId: `t${i}`,
        userText: `刚才又看到一株绿植 ${i}`,
        assistantText: '绿植真好',
        rawContent: [],
      });
    }
    const facts = await run({ query: '绿植', scope: 'facts', limit: 5 });
    expect(facts.data!.hits.length).toBeGreaterThanOrEqual(1);
    expect(facts.data!.hits.every((h) => h.source === 'l3')).toBe(true);
  });

  test('no memory db configured → structured err, not a throw', async () => {
    setMemoryDb(null);
    const e = await run({ query: '咖啡' });
    expect(e.kind).toBe('err');
  });

  test('summarize renders hit count', () => {
    expect(
      recallTool.summarize({ hits: [{ id: 'a', source: 'l3', text: 'x', score: 1, when_ms: 0 }] }),
    ).toBe('1 hit');
    expect(recallTool.summarize({ hits: [] })).toBe('0 hits');
  });

  test("scope 'skills' returns skill pointers that pass the output enum (v0.32.1)", async () => {
    const { saveSkill, setSkillsRecallMounted } = await import('../../skills/skillStore');
    setSkillsRecallMounted(true);
    saveSkill({ name: 'deploy-check', description: 'how to verify a deploy', body: 'SECRET' }, 1000);
    const res = await run({ query: 'verify deploy', scope: 'skills' });
    expect(res.kind).toBe('ok');
    const hits = res.data!.hits;
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => h.source === 'skills')).toBe(true);
    expect(hits[0]!.id).toBe('skill:deploy-check');
    expect(hits[0]!.text).not.toContain('SECRET'); // pointer only — body stays behind recall_skill
    // the wire schema accepts the new source (the closed-enum pitfall)
    expect(recallTool.output.safeParse(res.data).success).toBe(true);
  });

  test("scope 'both' includes skills alongside the other sources", async () => {
    const { saveSkill, setSkillsRecallMounted } = await import('../../skills/skillStore');
    setSkillsRecallMounted(true);
    saveSkill({ name: 'deploy-check', description: 'how to verify a deploy', body: 'b' }, 1000);
    addFact('preferences', 'likes deploy checklists');
    const res = await run({ query: 'deploy', scope: 'both' });
    const sources = new Set(res.data!.hits.map((h) => h.source));
    expect(sources.has('skills')).toBe(true);
    expect(sources.has('l3')).toBe(true);
  });

  test("scope 'skills' in a skills-off boot returns an honest error, not an empty library", async () => {
    const { saveSkill, setSkillsRecallMounted } = await import('../../skills/skillStore');
    setSkillsRecallMounted(false);
    saveSkill({ name: 'deploy-check', description: 'how to verify a deploy', body: 'b' }, 1000);
    const events: unknown[] = [];
    for await (const e of recallTool.execute({ query: 'deploy', scope: 'skills' }, ctx())) events.push(e);
    const first = events[0] as { kind: string; message?: string };
    expect(first.kind).toBe('err');
    expect(first.message).toContain('skill library is disabled');
  });
});
