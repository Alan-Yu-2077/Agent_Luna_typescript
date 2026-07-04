import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Database } from 'bun:sqlite';
import type Anthropic from '@anthropic-ai/sdk';
import { MockProvider } from '../provider/mock';
import type { ProviderEvent } from '../provider/types';
import { builtinRegistry } from '../tools/registry';
import { getSession, resetSessions } from '../turn/session';
import { runTurn } from '../turn/runTurn';
import { migrate } from '../sql';
import { setMemoryDb } from '../memory/sessionStore';
import { seedFixedCore, updateFixedCore } from '../memory/soulStore';
import { loadPersona, resetPersonaCache } from './loader';
import {
  MAX_CHARS,
  MAX_CLAUSE_CHARS,
  MAX_SENTENCES,
  longestClauseLength,
  renderHumanityBlock,
  splitClauses,
  splitSentences,
} from './humanity';
import { WAKE_SCENE_BLOCK } from './scene';

let dir: string;
const savedPath = Bun.env['LUNA_PERSONA_PATH'];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'luna-persona-'));
  resetPersonaCache();
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  if (savedPath === undefined) delete Bun.env['LUNA_PERSONA_PATH'];
  else Bun.env['LUNA_PERSONA_PATH'] = savedPath;
  resetPersonaCache();
});

describe('persona loader (mtime cache)', () => {
  test('default path loads the repo persona file', () => {
    delete Bun.env['LUNA_PERSONA_PATH'];
    const p = loadPersona();
    // v0.30.0: default.md restructured into the soul-file fixed-core sections
    expect(p.text).toContain('Identity core');
    expect(p.text).toContain('newly awakened');
  });

  test('unchanged mtime returns the same object (no re-read)', () => {
    const file = join(dir, 'p.md');
    writeFileSync(file, 'persona v1');
    Bun.env['LUNA_PERSONA_PATH'] = file;
    const a = loadPersona();
    const b = loadPersona();
    expect(b).toBe(a);
    expect(a.text).toBe('persona v1');
  });

  test('mtime change reloads new content', () => {
    const file = join(dir, 'p.md');
    writeFileSync(file, 'persona v1');
    Bun.env['LUNA_PERSONA_PATH'] = file;
    const a = loadPersona();
    writeFileSync(file, 'persona v2');
    // force a distinct mtime even on coarse filesystem clocks
    utimesSync(file, new Date(), new Date(Date.now() + 5000));
    const b = loadPersona();
    expect(a.text).toBe('persona v1');
    expect(b.text).toBe('persona v2');
  });

  test('missing file degrades to fallback without throwing', () => {
    Bun.env['LUNA_PERSONA_PATH'] = join(dir, 'nope.md');
    const p = loadPersona();
    expect(p.text).toContain('newly awakened');
    expect(p.text.length).toBeGreaterThan(0);
    // v0.27.5: the fallback still carries the non-negotiable anti-assistant guardrails
    expect(p.text).toContain('therapist');
    expect(p.text).toContain('assistant politeness');
  });
});

describe('humanity splitters', () => {
  test('CJK sentence punctuation splits, consecutive marks collapse', () => {
    expect(splitSentences('你好。今天怎么样？？很好！')).toEqual(['你好', '今天怎么样', '很好']);
  });

  test('ASCII punctuation and newlines split', () => {
    expect(splitSentences('Hi! How are you?\nGood')).toEqual(['Hi', 'How are you', 'Good']);
  });

  test('mixed text without terminal punctuation is one sentence', () => {
    expect(splitSentences('就一句话而已')).toEqual(['就一句话而已']);
  });

  test('clauses split on CJK/ASCII commas, semicolons, colons AND sentence marks', () => {
    expect(splitClauses('一部分，另一部分；再来：最后。还有一句')).toEqual([
      '一部分',
      '另一部分',
      '再来',
      '最后',
      '还有一句',
    ]);
  });

  test('longestClauseLength measures the max clause', () => {
    expect(longestClauseLength('短，这一段要长得多一些一些')).toBe(11);
    expect(longestClauseLength('')).toBe(0);
  });

  test('humanity block states the three caps', () => {
    const block = renderHumanityBlock();
    expect(block).toContain(String(MAX_CHARS));
    expect(block).toContain(String(MAX_SENTENCES));
    expect(block).toContain(String(MAX_CLAUSE_CHARS));
  });

  test('humanity block bans the assistant-filler closer tic (v0.23.5)', () => {
    const block = renderHumanityBlock();
    // the exact leaked phrase + the "a reply can just end" permission must be present
    expect(block).toContain("What's on your mind?");
    expect(block).toContain('Still here');
    expect(block).toContain('can simply end');
    expect(block.toLowerCase()).toContain('engagement bait');
  });
});

describe('wake scene block', () => {
  test('is a single stage-direction string mentioning wake-up', () => {
    expect(WAKE_SCENE_BLOCK).toContain('first message after wake-up');
    expect(WAKE_SCENE_BLOCK.startsWith('Scene state:')).toBe(true);
  });
});

function endRound(text: string): ProviderEvent[] {
  return [
    { kind: 'text_delta', text },
    {
      kind: 'message_stop',
      stopReason: 'end_turn',
      toolUses: [],
      assistantContent: [{ type: 'text', text }] as unknown as Anthropic.ContentBlock[],
      usage: { input_tokens: 1, output_tokens: 1 },
    },
  ];
}

function userBlocks(req: { messages: Anthropic.MessageParam[] }, index: number): string[] {
  const msg = req.messages.filter((m) => m.role === 'user')[index];
  const content = msg?.content;
  if (!Array.isArray(content)) return [];
  return content.filter((b) => b.type === 'text').map((b) => (b as { text: string }).text);
}

describe('persona system-prompt integration (runTurn)', () => {
  test('scene block rides only the first user turn after boot, never system', async () => {
    resetSessions();
    const session = getSession('persona-scene');
    const provider = new MockProvider([endRound('one'), endRound('two')]);
    const opts = { session, provider, registry: builtinRegistry, emit: () => {} };
    await runTurn({ ...opts, turnId: 't1', userText: 'hello' });
    await runTurn({ ...opts, turnId: 't2', userText: 'again' });

    const req1 = provider.requests[0]!;
    const req2 = provider.requests[1]!;
    expect(userBlocks(req1, 0).some((t) => t.startsWith('Scene state:'))).toBe(true);
    expect(userBlocks(req2, 1).some((t) => t.startsWith('Scene state:'))).toBe(false);
    expect(JSON.stringify(req1.system)).not.toContain('Scene state:');
    expect(JSON.stringify(req2.system)).not.toContain('Scene state:');
  });

  // v0.30.3: the persona is DB-sourced (the soul's fixed core), not the file — so a change flows
  // through a soul write, which bumps the memory epoch. v0.31.0: a runtime fixed-core change is an
  // owner edit (updateFixedCore); seedFixedCore is first-boot-only (seed-if-empty) and no longer
  // re-clobbers on change.
  test('a soul change flows into the system prompt exactly once, then stable', async () => {
    resetSessions();
    const db = new Database(':memory:', { strict: true });
    migrate(db, join(import.meta.dir, '..', 'migrations'));
    setMemoryDb(db);
    try {
      seedFixedCore('persona generation one');
      const session = getSession('persona-edit');
      const provider = new MockProvider([endRound('a'), endRound('b'), endRound('c')]);
      const opts = { session, provider, registry: builtinRegistry, emit: () => {} };
      await runTurn({ ...opts, turnId: 't1', userText: 'x' });
      await runTurn({ ...opts, turnId: 't2', userText: 'y' });

      updateFixedCore('persona generation two'); // an owner edit of the fixed core → epoch bump
      await runTurn({ ...opts, turnId: 't3', userText: 'z' });

      const sys = provider.requests.map((r) => JSON.stringify(r.system));
      expect(sys[0]).toBe(sys[1]!);
      expect(sys[2]).not.toBe(sys[1]!);
      expect(sys[0]).toContain('generation one');
      expect(sys[2]).toContain('generation two');
    } finally {
      setMemoryDb(null);
      db.close(false);
    }
  });
});
