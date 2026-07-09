import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import { migrate } from '../sql';
import { setMemoryDb } from '../memory/sessionStore';
import { addFact } from '../memory/l3Store';
import { saveSkill, skillEmbedText, getSkill, setSkillsRecallMounted } from '../skills/skillStore';
import { contentHash, embedCacheKey } from '../memory/recall/embed';
import { resetDreamStateForTests } from './dreamState';
import { runDreamCycle } from './cycle';
import { MockProvider } from '../provider/mock';
import { TraceStore } from '../trace/store';
import { setTraceStore } from '../trace/instrument';
import { resetSessions } from '../turn/session';
import type { DreamLLM } from './llm';

// v0.32.1 regression: rag_refresh pre-warmed embeddings under contentHash(text)
// while retrieve() reads embedCacheKey(text) (model-namespaced since v0.20.5) —
// the keys never matched, so every warmed vector was dead work. Pinned here in
// both directions: warmed rows exist under embedCacheKey, none under the old key.

let db: Database;
const embedded: string[][] = [];

// Every dream step's LLM output is garbage → those steps fail harmlessly and the
// cycle proceeds; rag_refresh (no LLM) is what this test exercises.
function garbageLlm(): DreamLLM {
  const provider = new MockProvider([]);
  provider.completeResponder = () => 'not json';
  return { primary: provider, fallback: null };
}

describe('rag_refresh embed-key fix (v0.32.1)', () => {
  beforeEach(() => {
    db = new Database(':memory:', { strict: true });
    migrate(db, join(import.meta.dir, '..', 'migrations'));
    setMemoryDb(db);
    setTraceStore(new TraceStore(db));
    resetDreamStateForTests();
    resetSessions();
    embedded.length = 0;
    Bun.env['LUNA_MEMORY_EMBEDDING'] = '1';
    Bun.env['LUNA_EMBEDDING_API_KEY'] = 'test-key';
    setSkillsRecallMounted(true);
  });
  afterEach(() => {
    setMemoryDb(null);
    setTraceStore(null);
    resetDreamStateForTests();
    db.close(false);
    resetSessions();
    Bun.env['LUNA_MEMORY_EMBEDDING'] = '0';
    delete Bun.env['LUNA_EMBEDDING_API_KEY'];
    setSkillsRecallMounted(false);
  });

  test('pre-warm writes under embedCacheKey (readable by recall), incl. skill texts; second cycle is warm', async () => {
    addFact('preferences', 'likes tea in the morning');
    saveSkill({ name: 'brew-notes', description: 'tea method', body: 'steps' }, 1000);

    const embedClient = async (texts: string[]) => {
      embedded.push([...texts]);
      return texts.map(() => new Float32Array([1, 0, 0, 0]));
    };
    const r1 = await runDreamCycle({
      sessionId: 'default',
      llm: garbageLlm(),
      emit: () => {},
      embedClient,
    });
    expect(r1.ok).toBe(true);

    const has = (hash: string) =>
      db.prepare('SELECT 1 FROM embeddings_cache WHERE hash = ?').get(hash) !== null;
    const factText = 'likes tea in the morning';
    const skillText = skillEmbedText(getSkill('brew-notes')!);
    // the fix: rows live under the model-namespaced key retrieve() reads...
    expect(has(embedCacheKey(factText))).toBe(true);
    expect(has(embedCacheKey(skillText))).toBe(true);
    // ...not under the bare content hash the old code wrote (keys differ by construction)
    expect(embedCacheKey(factText)).not.toBe(contentHash(factText));
    expect(has(contentHash(factText))).toBe(false);

    // a second cycle finds the cache warm — nothing re-embedded
    const callsAfterFirst = embedded.length;
    resetDreamStateForTests();
    const r2 = await runDreamCycle({
      sessionId: 'default',
      llm: garbageLlm(),
      emit: () => {},
      embedClient,
    });
    expect(r2.ok).toBe(true);
    expect(embedded.length).toBe(callsAfterFirst);
  });
});
