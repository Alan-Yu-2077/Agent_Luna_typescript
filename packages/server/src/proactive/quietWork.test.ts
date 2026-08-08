import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import type Anthropic from '@anthropic-ai/sdk';
import { migrate } from '../sql';
import { setMemoryDb } from '../memory/sessionStore';
import { MockProvider } from '../provider/mock';
import type { ProviderEvent } from '../provider/types';
import { messageRegistry } from '../tools/registry';
import { getSession, resetSessions } from '../turn/session';
import { runProactiveTurn, resetProactiveOpenersForTests } from './proactiveTurn';
import {
  LEGACY_GROUND_RULE,
  classifyOutcome,
  closingRule,
  compressNote,
  groundRuleFor,
  isWander,
  recordOutcome,
  wandersUsedToday,
} from './quietWork';

// v0.45.10 — the quiet-agency surgery, pinned: the three-way ground rule replaces the tool-ban
// closer (and byte-identical rollback under the flag), outcomes classify and land in the ledger,
// the wander budget narrows the menu, and the anti-rumination clause is IN the wander item.

const ENV = ['LUNA_QUIET_WORK', 'LUNA_QUIET_WANDER_DAILY'];
const saved: Record<string, string | undefined> = {};

let db: Database;
beforeEach(() => {
  for (const k of ENV) saved[k] = Bun.env[k];
  db = new Database(':memory:', { strict: true });
  migrate(db, join(import.meta.dir, '..', 'migrations'));
  setMemoryDb(db);
  resetSessions();
  resetProactiveOpenersForTests();
});
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete Bun.env[k];
    else Bun.env[k] = saved[k];
  }
  setMemoryDb(null);
  db.close(false);
});

describe('classifyOutcome (pure)', () => {
  test('spoke wins; tools without words = quiet; nothing at all = nothing', () => {
    expect(classifyOutcome(true, ['message'])).toBe('spoke');
    expect(classifyOutcome(true, ['message', 'remember'])).toBe('spoke');
    expect(classifyOutcome(false, ['remember', 'web_search'])).toBe('quiet');
    expect(classifyOutcome(false, [])).toBe('nothing');
    // a failed message delivery with no other tool is still nothing, not quiet
    expect(classifyOutcome(false, ['message'])).toBe('nothing');
  });

  test('isWander keys on the web pair', () => {
    expect(isWander(['remember'])).toBe(false);
    expect(isWander(['web_search', 'remember'])).toBe(true);
    expect(isWander(['web_fetch'])).toBe(true);
  });
});

describe('compressNote', () => {
  test('collapses counts into one human line', () => {
    const n = compressNote(['web_search', 'web_fetch', 'web_fetch', 'remember', 'message']);
    expect(n).toBe('searched the web · read 2 pages · saved a memory');
  });

  test('unknown tools degrade to a generic verb; the line is hard-capped', () => {
    expect(compressNote(['plan'])).toBe('used plan');
    const long = compressNote(Array.from({ length: 30 }, (_, i) => `tool_${i}`));
    expect(long.length).toBeLessThanOrEqual(140);
    expect(long.endsWith('…')).toBe(true);
  });
});

describe('the ledger + wander budget', () => {
  test('outcomes land; wanders count only quiet+wandered rows since local midnight', () => {
    const now = Date.now();
    recordOutcome('default', 'quiet', 'searched the web', true, now);
    recordOutcome('default', 'quiet', 'saved a memory', false, now);
    recordOutcome('default', 'nothing', '', false, now);
    recordOutcome('default', 'quiet', 'read a page', true, now - 48 * 3_600_000); // two days ago
    expect(wandersUsedToday(now)).toBe(1);
    const rows = db.prepare('SELECT kind, note, wandered FROM proactive_outcomes ORDER BY id').all() as Array<{
      kind: string;
      note: string;
      wandered: number;
    }>;
    expect(rows.length).toBe(4);
    expect(rows[0]).toMatchObject({ kind: 'quiet', note: 'searched the web', wandered: 1 });
  });
});

describe('the three-way ground rule', () => {
  test('carries the menu, the anti-rumination clause, and rest legitimacy', () => {
    const r = groundRuleFor(3);
    expect(r).toContain('QUIET WORK');
    expect(r).toContain('do NOT extend what you two just talked about');
    expect(r).toContain('YOUR OWN interests');
    expect(r).toContain('Wander (3 left today)');
    expect(r).toContain('resting is a real choice, not a failure');
    expect(r).toContain('prefer it over reopening old threads'); // seeds first when speaking
    expect(r).not.toContain('call no tool'); // the M2 revocation is gone
  });

  test('budget exhausted → the wander item narrows away', () => {
    const r = groundRuleFor(0);
    expect(r).not.toContain('Wander (');
    expect(r).toContain('No wanders left today');
    expect(r).toContain('Patch the record'); // patching stays (zero-budget work)
  });

  test('flag off → the ORIGINAL closer, byte-identical (the rollback pin)', () => {
    Bun.env['LUNA_QUIET_WORK'] = '0';
    expect(closingRule()).toBe(LEGACY_GROUND_RULE);
    expect(closingRule()).toContain('call no tool');
  });

  test('flag on (default) → three-way with the live budget', () => {
    delete Bun.env['LUNA_QUIET_WORK'];
    Bun.env['LUNA_QUIET_WANDER_DAILY'] = '2';
    recordOutcome('default', 'quiet', 'x', true);
    expect(closingRule()).toContain('Wander (1 left today)');
  });
});

describe('runProactiveTurn integration', () => {
  const endRound: ProviderEvent = {
    kind: 'message_stop',
    stopReason: 'end_turn',
    toolUses: [],
    assistantContent: [] as unknown as Anthropic.ContentBlock[],
    usage: { input_tokens: 5, output_tokens: 1 },
  };

  test('a silent no-tool waking records nothing; the framing carries the three-way rule', async () => {
    const provider = new MockProvider([[endRound]]);
    const session = getSession('default');
    await runProactiveTurn({
      session,
      cycleId: 'c1',
      provider,
      registry: messageRegistry,
      emit: () => {},
      scenario: 'ambient',
    });
    const sent = JSON.stringify(provider.requests[0]?.messages ?? []);
    expect(sent).toContain('QUIET WORK');
    expect(sent).not.toContain('call no tool');
    const rows = db.prepare('SELECT kind FROM proactive_outcomes').all() as Array<{ kind: string }>;
    expect(rows).toEqual([{ kind: 'nothing' }]);
  });

  test('flag off → the original framing and zero ledger rows', async () => {
    Bun.env['LUNA_QUIET_WORK'] = '0';
    const provider = new MockProvider([[endRound]]);
    const session = getSession('default');
    await runProactiveTurn({
      session,
      cycleId: 'c2',
      provider,
      registry: messageRegistry,
      emit: () => {},
      scenario: 'ambient',
    });
    const sent = JSON.stringify(provider.requests[0]?.messages ?? []);
    expect(sent).toContain('call no tool');
    expect(sent).not.toContain('QUIET WORK');
    expect((db.prepare('SELECT COUNT(*) AS n FROM proactive_outcomes').get() as { n: number }).n).toBe(0);
  });

  test('a quiet waking (tool, no word) records quiet with the note', async () => {
    const toolUses = [{ id: 't1', name: 'recall', input: { query: '今天' } }];
    const rounds: ProviderEvent[][] = [
      [
        {
          kind: 'message_stop',
          stopReason: 'tool_use',
          toolUses,
          assistantContent: toolUses.map((t) => ({
            type: 'tool_use',
            id: t.id,
            name: t.name,
            input: t.input,
          })) as unknown as Anthropic.ContentBlock[],
          usage: { input_tokens: 5, output_tokens: 2 },
        },
      ],
      [endRound],
    ];
    const provider = new MockProvider(rounds);
    const session = getSession('default');
    const { spoke } = await runProactiveTurn({
      session,
      cycleId: 'c3',
      provider,
      registry: messageRegistry,
      emit: () => {},
      scenario: 'ambient',
    });
    expect(spoke).toBe(false);
    const row = db.prepare('SELECT kind, note FROM proactive_outcomes').get() as { kind: string; note: string };
    expect(row.kind).toBe('quiet');
    expect(row.note).toBe('looked through her memories');
  });
});
