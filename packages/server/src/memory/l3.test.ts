import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import type Anthropic from '@anthropic-ai/sdk';
import { MockProvider } from '../provider/mock';
import type { ProviderEvent } from '../provider/types';
import { builtinRegistry } from '../tools/registry';
import { getSession, resetSessions } from '../turn/session';
import { runTurn } from '../turn/runTurn';
import { migrate } from '../sql';
import { setMemoryDb } from './sessionStore';
import { addFact, forgetFact, listFacts } from './l3Store';
import { getCore, restore, updateCore } from './coreMemory';
import { renderCoreBlock } from './renderCoreBlock';

let db: Database;

beforeEach(() => {
  db = new Database(':memory:', { strict: true });
  migrate(db, join(import.meta.dir, '..', 'migrations'));
  setMemoryDb(db);
  resetSessions();
});

afterEach(() => {
  setMemoryDb(null);
  db.close(false);
  resetSessions();
});

describe('l3Store', () => {
  test('add persists; forget soft-deletes; asOf time-travel sees the past', async () => {
    const added = addFact('core_facts', 'Alan lives in Shanghai');
    expect(added?.status).toBe('added');
    const beforeForget = Date.now();
    await Bun.sleep(2);

    const forgotten = forgetFact(added!.id);
    expect(forgotten?.status).toBe('forgotten');

    expect(listFacts({ category: 'core_facts' }).length).toBe(0);
    const past = listFacts({ category: 'core_facts', asOf: beforeForget });
    expect(past.length).toBe(1);
    expect(past[0]?.text).toBe('Alan lives in Shanghai');

    const row = db.prepare('SELECT deleted_ms FROM l3_facts WHERE id = ?').get(added!.id) as {
      deleted_ms: number | null;
    };
    expect(row.deleted_ms).not.toBeNull();
  });

  test('forget unknown id → not_found', () => {
    expect(forgetFact('cf_nope')?.status).toBe('not_found');
  });

  test('dedup: punctuation variant skipped; re-add after forget creates fresh row', () => {
    const a = addFact('preferences', 'likes green tea');
    const b = addFact('preferences', 'Likes green tea!!');
    expect(b?.status).toBe('deduped');
    expect(b?.id).toBe(a!.id);

    forgetFact(a!.id);
    const c = addFact('preferences', 'likes green tea');
    expect(c?.status).toBe('added');
    expect(c?.id).not.toBe(a!.id);
  });

  test('active_threads expire via TTL; other categories do not', () => {
    const at = addFact('active_threads', 'planning the trip');
    db.prepare('UPDATE l3_facts SET expires_ms = ? WHERE id = ?').run(Date.now() - 1000, at!.id);
    expect(listFacts({ category: 'active_threads' }).length).toBe(0);
    addFact('core_facts', 'permanent fact');
    expect(listFacts({ category: 'core_facts' }).length).toBe(1);
  });
});

describe('coreMemory', () => {
  test('update audits prior state; restore(1) rolls back', () => {
    updateCore({ self_state: 'curious and warm', relationship_status: 'new friends' }, 'test');
    updateCore({ relationship_status: 'close friends' }, 'test');
    expect(getCore().relationship_status).toBe('close friends');
    expect(getCore().self_state).toBe('curious and warm');

    const restored = restore(1);
    expect(restored?.relationship_status).toBe('new friends');
    expect(restored?.self_state).toBe('curious and warm');

    const auditCount = db.prepare('SELECT COUNT(*) c FROM core_memory_audit').get() as {
      c: number;
    };
    expect(auditCount.c).toBe(3);
  });
});

describe('renderCoreBlock + cache stability', () => {
  test('renders core memory + capped facts deterministically; unset memory renders empty', () => {
    expect(renderCoreBlock()).toBe('');
    updateCore({ self_state: 'gentle, curious' }, 'test');
    addFact('core_facts', 'Alan writes TypeScript');
    const a = renderCoreBlock();
    const b = renderCoreBlock();
    expect(a).toBe(b);
    expect(a).toContain('gentle, curious');
    expect(a).toContain('Alan writes TypeScript');
    expect(a).toContain('remember tool');
  });

  test('system prompt is byte-identical across turns without memory change, differs after', async () => {
    addFact('core_facts', 'Alan likes precise systems');
    const session = getSession('test');

    function endRound(text: string): ProviderEvent[] {
      return [
        { kind: 'text_delta', text },
        {
          kind: 'message_stop',
          stopReason: 'end_turn',
          toolUses: [],
          assistantContent: [
            { type: 'text', text },
          ] as unknown as Anthropic.ContentBlock[],
          usage: { input_tokens: 1, output_tokens: 1 },
        },
      ];
    }

    const provider = new MockProvider([endRound('one'), endRound('two'), endRound('three')]);
    await runTurn({ session, turnId: 't1', userText: 'a', provider, registry: builtinRegistry, emit: () => {} });
    await runTurn({ session, turnId: 't2', userText: 'b', provider, registry: builtinRegistry, emit: () => {} });

    const sys1 = JSON.stringify(provider.requests[0]?.system);
    const sys2 = JSON.stringify(provider.requests[1]?.system);
    expect(sys1).toBe(sys2);
    expect(sys1).toContain('cache_control');

    addFact('preferences', 'prefers dark mode');
    await runTurn({ session, turnId: 't3', userText: 'c', provider, registry: builtinRegistry, emit: () => {} });
    const sys3 = JSON.stringify(provider.requests[2]?.system);
    expect(sys3).not.toBe(sys2);
  });
});
