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
    addFact('preferences', '用户喜欢在家煮意式浓缩咖啡');
    addFact('core_facts', '用户的名字是 Alan');
    const e = await run({ query: '咖啡' });
    expect(e.kind).toBe('ok');
    expect(e.data!.hits.length).toBeGreaterThanOrEqual(1);
    expect(e.data!.hits.some((h) => h.text.includes('咖啡'))).toBe(true);
  });

  test('respects limit', async () => {
    for (let i = 0; i < 6; i++) addFact('key_moments', `关于猫的第${i}个回忆，猫咪很可爱`);
    const e = await run({ query: '猫', limit: 2 });
    expect(e.data!.hits.length).toBe(2);
  });

  test('scope=facts returns only l3, scope=timeline only l2', async () => {
    addFact('preferences', '用户喜欢猫');
    appendL2({
      sessionId: 'test',
      turnId: 't1',
      userText: '我家的猫叫 Mochi',
      assistantText: '记住了',
      rawContent: [],
    });
    const facts = await run({ query: '猫', scope: 'facts' });
    expect(facts.data!.hits.every((h) => h.source === 'l3')).toBe(true);
    const timeline = await run({ query: '猫', scope: 'timeline' });
    expect(timeline.data!.hits.every((h) => h.source === 'l2')).toBe(true);
  });

  test('no memory db configured → structured err, not a throw', async () => {
    setMemoryDb(null);
    const e = await run({ query: '咖啡' });
    expect(e.kind).toBe('err');
  });

  test('summarize renders hit count', () => {
    expect(recallTool.summarize({ hits: [{ id: 'a', source: 'l3', text: 'x', score: 1, when_ms: 0 }] })).toBe(
      '1 hit',
    );
    expect(recallTool.summarize({ hits: [] })).toBe('0 hits');
  });
});
