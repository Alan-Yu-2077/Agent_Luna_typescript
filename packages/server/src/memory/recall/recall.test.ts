import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import type Anthropic from '@anthropic-ai/sdk';
import { MockProvider } from '../../provider/mock';
import type { ProviderEvent } from '../../provider/types';
import { builtinRegistry } from '../../tools/registry';
import { getSession, resetSessions } from '../../turn/session';
import { runTurn } from '../../turn/runTurn';
import { migrate } from '../../sql';
import { appendL2, setMemoryDb } from '../sessionStore';
import { addFact, forgetFact } from '../l3Store';
import { lexicalScore, tokenize } from './lexical';
import {
  resetRecallStateForTests,
  retrieve,
  renderRecallBlock,
  setEmbedClientForTests,
} from './recall';
import type { EmbedClient } from './embed';

let db: Database;

// Deterministic fake embeddings: a few known concept axes so paraphrases map close.
const CONCEPTS: [string, number][] = [
  ['beverage', 0],
  ['coffee', 0],
  ['espresso', 0],
  ['latte', 0],
  ['weather', 1],
  ['rain', 1],
  ['sunny', 1],
  ['code', 2],
  ['typescript', 2],
  ['program', 2],
];

function fakeVec(text: string): Float32Array {
  const v = new Float32Array(4);
  const lower = text.toLowerCase();
  for (const [word, axis] of CONCEPTS) {
    if (lower.includes(word)) v[axis]! += 1;
  }
  v[3] = 0.01;
  return v;
}

let embedCalls: string[][] = [];
const fakeClient: EmbedClient = async (texts) => {
  embedCalls.push([...texts]);
  return texts.map(fakeVec);
};

beforeEach(() => {
  db = new Database(':memory:', { strict: true });
  migrate(db, join(import.meta.dir, '..', '..', 'migrations'));
  setMemoryDb(db);
  setEmbedClientForTests(fakeClient);
  resetRecallStateForTests();
  resetSessions();
  embedCalls = [];
  Bun.env['LUNA_EMBEDDING_API_KEY'] = 'test-key';
  delete Bun.env['LUNA_MEMORY_EMBEDDING'];
});

afterEach(() => {
  setMemoryDb(null);
  setEmbedClientForTests(null);
  resetRecallStateForTests();
  db.close(false);
  resetSessions();
  delete Bun.env['LUNA_EMBEDDING_API_KEY'];
  delete Bun.env['LUNA_MEMORY_EMBEDDING'];
});

function seedL2(sessionId: string, turns: [string, string][]): void {
  for (let i = 0; i < turns.length; i++) {
    appendL2({
      sessionId,
      turnId: `t${i}`,
      userText: turns[i]![0],
      assistantText: turns[i]![1],
      rawContent: [],
    });
  }
}

describe('lexical (CJK bigram)', () => {
  test('tokenize produces CJK bigrams + ascii words', () => {
    const tokens = tokenize('上周聊了 typescript 的事');
    expect(tokens.has('typescript')).toBe(true);
    expect(tokens.has('上周')).toBe(true);
    expect(tokens.has('周聊')).toBe(true);
  });

  test('Chinese query matches without any API', () => {
    const score = lexicalScore('上周我们聊了什么', '上周聊了去东京旅行的计划');
    expect(score).toBeGreaterThan(0.2);
  });
});

describe('retrieve (hybrid)', () => {
  test('paraphrase semantic hit: no shared keywords, embedding finds it', async () => {
    seedL2('s', [
      ['I love espresso in the morning', 'noted, a latte person'],
      ['the weather is awful today', 'rain again'],
    ]);
    const hits = await retrieve('s', 'what beverage do I enjoy?');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.text).toContain('espresso');
  });

  test('embedding off → lexical-only, zero API calls', async () => {
    Bun.env['LUNA_MEMORY_EMBEDDING'] = '0';
    seedL2('s', [['我们聊过东京的樱花', '春天去看樱花']]);
    const hits = await retrieve('s', '樱花');
    expect(hits.length).toBe(1);
    expect(embedCalls.length).toBe(0);
  });

  test('hash cache: second retrieve embeds nothing new', async () => {
    seedL2('s', [['coffee talk', 'espresso reply']]);
    await retrieve('s', 'coffee');
    const callsAfterFirst = embedCalls.length;
    await retrieve('s', 'coffee');
    expect(embedCalls.length).toBe(callsAfterFirst);
  });

  test('recency boost breaks ties toward newer', async () => {
    Bun.env['LUNA_MEMORY_EMBEDDING'] = '0';
    const old = Date.now() - 30 * 86_400_000;
    db.prepare(
      'INSERT INTO l2_turns (session_id, turn_id, t_ms, user_text, assistant_text, raw_json) VALUES (?, ?, ?, ?, ?, ?)',
    ).run('s', 'old', old, 'we discussed the tokyo trip', 'yes', '[]');
    db.prepare(
      'INSERT INTO l2_turns (session_id, turn_id, t_ms, user_text, assistant_text, raw_json) VALUES (?, ?, ?, ?, ?, ?)',
    ).run('s', 'new', Date.now(), 'we discussed the tokyo trip', 'again', '[]');
    const hits = await retrieve('s', 'tokyo trip');
    expect(hits[0]?.id).not.toBe(undefined);
    const first = db
      .prepare('SELECT turn_id FROM l2_turns WHERE id = ?')
      .get(Number(hits[0]!.id)) as { turn_id: string };
    expect(first.turn_id).toBe('new');
  });

  test('soft-deleted facts never surface', async () => {
    Bun.env['LUNA_MEMORY_EMBEDDING'] = '0';
    const added = addFact('preferences', 'loves matcha desserts');
    forgetFact(added!.id);
    const hits = await retrieve('s', 'matcha desserts');
    expect(hits.find((h) => h.source === 'l3')).toBeUndefined();
  });

  test('renderRecallBlock formats hits; null when empty', () => {
    expect(renderRecallBlock([])).toBeNull();
    const block = renderRecallBlock([
      { source: 'l3', id: 'cf_1', text: 'likes tea', score: 0.9, t_ms: 1 },
    ]);
    expect(block).toContain('<memory>');
    expect(block).toContain('likes tea');
  });
});

describe('system prompt cache invariant with recall', () => {
  test('system stays byte-identical across different queries (recall is message-level)', async () => {
    addFact('core_facts', 'Alan builds Luna');
    seedL2('test', [['talked about espresso', 'noted']]);
    const session = getSession('test');

    function endRound(text: string): ProviderEvent[] {
      return [
        {
          kind: 'message_stop',
          stopReason: 'end_turn',
          toolUses: [],
          assistantContent: [{ type: 'text', text }] as unknown as Anthropic.ContentBlock[],
          usage: { input_tokens: 1, output_tokens: 1 },
        },
      ];
    }
    const provider = new MockProvider([endRound('a'), endRound('b')]);

    await runTurn({ session, turnId: 't1', userText: 'tell me about coffee', provider, registry: builtinRegistry, emit: () => {} });
    await runTurn({ session, turnId: 't2', userText: '天气怎么样', provider, registry: builtinRegistry, emit: () => {} });

    expect(JSON.stringify(provider.requests[0]?.system)).toBe(
      JSON.stringify(provider.requests[1]?.system),
    );

    const user2 = provider.requests[1]?.messages.at(-1);
    const blocks = user2?.content as Anthropic.TextBlockParam[];
    const hasRecall = blocks.some((b) => b.text.includes('<memory>'));
    expect(hasRecall).toBe(true);
    expect(blocks.at(-1)?.text).toBe('天气怎么样');
  });
});
