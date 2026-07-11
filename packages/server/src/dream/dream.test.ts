import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import type Anthropic from '@anthropic-ai/sdk';
import type { ServerEvent } from '@luna/protocol';
import { MockProvider } from '../provider/mock';
import type { CompleteRequest, ProviderEvent } from '../provider/types';
import { builtinRegistry } from '../tools/registry';
import { getSession, resetSessions } from '../turn/session';
import { runTurn } from '../turn/runTurn';
import { migrate } from '../sql';
import { setMemoryDb } from '../memory/sessionStore';
import { addFact, listFacts } from '../memory/l3Store';
import { getSoul, seedFixedCore, updateEvolving } from '../memory/soulStore';
import { TraceStore } from '../trace/store';
import { setTraceStore } from '../trace/instrument';
import {
  bootReconcile,
  dreamStatus,
  isDreaming,
  resetDreamStateForTests,
  wake,
} from './dreamState';
import { runDreamCycle } from './cycle';
import { dreamCall, type DreamLLM } from './llm';
import { memoryAuditPrompt, personaUpdatePrompt, refineSemanticPrompt } from './prompts';

let db: Database;

beforeEach(() => {
  db = new Database(':memory:', { strict: true });
  migrate(db, join(import.meta.dir, '..', 'migrations'));
  setMemoryDb(db);
  setTraceStore(new TraceStore(db));
  resetDreamStateForTests();
  resetSessions();
  Bun.env['LUNA_MEMORY_EMBEDDING'] = '0';
});

afterEach(() => {
  setMemoryDb(null);
  setTraceStore(null);
  resetDreamStateForTests();
  db.close(false);
  resetSessions();
  Bun.env['LUNA_MEMORY_EMBEDDING'] = '0';
});

const NOOP_PATCH = '{"remove_ids": [], "add": []}';
const NOOP_PERSONA = '{"self_state": null, "relationship_status": null}';

// Routes dream prompts to scripted responses by content sniffing.
function scriptedLlm(script?: Partial<Record<string, string | (() => string)>>): {
  llm: DreamLLM;
  provider: MockProvider;
} {
  const provider = new MockProvider([]);
  provider.completeResponder = (req: CompleteRequest) => {
    const prompt = typeof req.messages[0]?.content === 'string' ? req.messages[0].content : '';
    let key = 'other';
    if (prompt.includes('duplicates that say the same thing')) key = 'refine';
    else if (prompt.includes('auditing your long-term memory')) key = 'audit';
    else if (prompt.includes('tending your own self-portrait')) key = 'persona';
    else if (prompt.includes('private diary')) key = 'diary';
    else if (prompt.includes('compress conversation history')) key = 'fold';
    else if (prompt.includes('how memorable each')) key = 'salience';
    const handler = script?.[key];
    if (typeof handler === 'function') return handler();
    if (typeof handler === 'string') return handler;
    if (key === 'refine' || key === 'audit') return NOOP_PATCH;
    if (key === 'persona') return NOOP_PERSONA;
    if (key === 'diary') return 'A quiet day; we talked and I noted things worth keeping.';
    if (key === 'salience') return JSON.stringify({ scores: Array(50).fill(3) });
    return '[mock]';
  };
  return { llm: { primary: provider, fallback: null }, provider };
}

function seedDialogue(sessionId: string, turns: [string, string][], dayOffset = 0): void {
  const base = Date.now() - dayOffset * 86_400_000;
  turns.forEach(([u, a], i) => {
    db.prepare(
      'INSERT INTO l2_turns (session_id, turn_id, t_ms, user_text, assistant_text, raw_json) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(sessionId, `seed${dayOffset}-${i}`, base + i * 1000, u, a, '[]');
  });
}

describe('dream cycle', () => {
  test('1. gate: chat.send rejected while dreaming; works after wake', async () => {
    seedDialogue('default', [['hello', 'hi']]);
    let release: (() => void) | null = null;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const { llm } = scriptedLlm({
      audit: () => {
        void gate;
        return NOOP_PATCH;
      },
      refine: NOOP_PATCH,
    });
    // Make refine_semantic wait so the cycle is observably "running".
    const slowLlm: DreamLLM = {
      primary: {
        capabilities: llm.primary.capabilities,
        complete: async (req) => {
          if (
            typeof req.messages[0]?.content === 'string' &&
            req.messages[0].content.includes('duplicates that say the same thing')
          ) {
            await gate;
          }
          return llm.primary.complete(req);
        },
        chatStream: llm.primary.chatStream.bind(llm.primary),
      },
      fallback: null,
    };
    addFact('core_facts', 'seed fact so refine is not skipped');

    const cycle = runDreamCycle({ sessionId: 'default', llm: slowLlm, emit: () => {} });
    expect(isDreaming()).toBe(true);

    expect(wake().ok).toBe(false);
    release!();
    await cycle;

    expect(dreamStatus().current_step).toBe('finished_idle');
    expect(isDreaming()).toBe(true);
    const woke = wake();
    expect(woke.ok).toBe(true);
    expect(isDreaming()).toBe(false);
  });

  test('2. double enter rejected; wake when not dreaming rejected', async () => {
    const { llm } = scriptedLlm();
    const first = runDreamCycle({ sessionId: 'default', llm, emit: () => {} });
    const second = await runDreamCycle({ sessionId: 'default', llm, emit: () => {} });
    expect(second.ok).toBe(false);
    await first;
    wake();
    expect(wake().ok).toBe(false);
  });

  test('2b. salience: dream rates unrated turns 1–5 and stores the scores (v0.17.0)', async () => {
    seedDialogue('default', [
      ['I adopted a dog named Rex', 'Rex! what a name'],
      ['nice weather', 'mm'],
    ]);
    // listUnratedL2 is most-recent-first → unrated[0]='nice weather', [1]='Rex'.
    const { llm } = scriptedLlm({ salience: JSON.stringify({ scores: [5, 1] }) });
    await runDreamCycle({ sessionId: 'default', llm, emit: () => {} });

    const rows = db.prepare('SELECT user_text, importance FROM l2_turns').all() as {
      user_text: string;
      importance: number | null;
    }[];
    const byText = Object.fromEntries(rows.map((r) => [r.user_text, r.importance]));
    expect(byText['nice weather']).toBe(5);
    expect(byText['I adopted a dog named Rex']).toBe(1);
  });

  // v0.20.6 — a score/turn count mismatch is rejected wholesale (positional map
  // would otherwise shift every later turn onto the wrong neighbour's score).
  test('2c. salience: a score/turn count mismatch is rejected, nothing written', async () => {
    seedDialogue('default', [
      ['I adopted a dog named Rex', 'Rex! what a name'],
      ['nice weather', 'mm'],
    ]);
    const { llm } = scriptedLlm({ salience: JSON.stringify({ scores: [4] }) }); // 1 score, 2 turns
    await runDreamCycle({ sessionId: 'default', llm, emit: () => {} });
    const rows = db.prepare('SELECT importance FROM l2_turns').all() as { importance: number | null }[];
    expect(rows.every((r) => r.importance === null)).toBe(true);
  });

  test('3. reconciliation: planted contradiction → exactly one active fact survives', async () => {
    const cat = addFact('preferences', 'User loves houseplants and wants one');
    seedDialogue('default', [
      ['actually I got a dog last week, I am off houseplants now', 'a dog! tell me everything'],
    ]);
    const { llm } = scriptedLlm({
      audit: JSON.stringify({
        remove_ids: [cat!.id],
        add: [{ category: 'preferences', text: 'User has a dog now (off houseplants)' }],
      }),
    });

    await runDreamCycle({ sessionId: 'default', llm, emit: () => {} });

    const active = listFacts({ category: 'preferences' });
    expect(active.length).toBe(1);
    expect(active[0]?.text).toContain('dog');
    const catRow = db.prepare('SELECT deleted_ms FROM l3_facts WHERE id = ?').get(cat!.id) as {
      deleted_ms: number | null;
    };
    expect(catRow.deleted_ms).not.toBeNull();
  });

  test('4. diaries: yesterday gets a day row; 7 day-diaries roll into a week', async () => {
    seedDialogue('default', [['we talked about tea', 'lovely']], 1);
    const { llm } = scriptedLlm();
    await runDreamCycle({ sessionId: 'default', llm, emit: () => {} });

    const days = db.prepare("SELECT period_key FROM diaries WHERE kind = 'day'").all();
    expect(days.length).toBeGreaterThanOrEqual(1);

    // 14 consecutive days always cover at least one complete week-group
    // regardless of alignment.
    for (let i = 2; i <= 15; i++) seedDialogue('default', [[`day ${i} chat`, 'noted']], i);
    resetDreamStateForTests();
    await runDreamCycle({ sessionId: 'default', llm, emit: () => {} });
    const weeks = db.prepare("SELECT period_key FROM diaries WHERE kind = 'week'").all();
    expect(weeks.length).toBeGreaterThanOrEqual(1);
  });

  test('4b. monthly diaries: 28 day-diaries in a month roll into a month entry (v0.17.1)', async () => {
    // run_diaries skips when L2 is empty, so give it a turn to chew on.
    seedDialogue('default', [['hello', 'hi']]);
    // Pre-seed 28 day diaries for 2026-05 directly (the day-gen cap is 20/cycle).
    for (let d = 1; d <= 28; d++) {
      const key = `2026-05-${String(d).padStart(2, '0')}`;
      db.prepare(
        'INSERT INTO diaries (kind, period_key, text, generated_ms) VALUES (?, ?, ?, ?)',
      ).run('day', key, `day ${key}`, Date.now());
    }
    const { llm } = scriptedLlm();
    await runDreamCycle({ sessionId: 'default', llm, emit: () => {} });

    const months = db.prepare("SELECT period_key FROM diaries WHERE kind = 'month'").all() as {
      period_key: string;
    }[];
    expect(months.some((m) => m.period_key === '2026-05')).toBe(true);

    // idempotent: a second cycle does not create a duplicate month entry
    resetDreamStateForTests();
    await runDreamCycle({ sessionId: 'default', llm, emit: () => {} });
    const monthCount = (
      db
        .prepare("SELECT COUNT(*) c FROM diaries WHERE kind = 'month' AND period_key = '2026-05'")
        .get() as {
        c: number;
      }
    ).c;
    expect(monthCount).toBe(1);
  });

  test('4c. today + yesterday rewritten each dream; older days stay write-once (v0.17.3 + v0.21.7)', async () => {
    let diaryN = 0;
    const { llm } = scriptedLlm({ diary: () => `diary v${++diaryN}` });
    const today = new Date(Date.now()).toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
    const readDay = (key: string) =>
      ((db.prepare("SELECT text FROM diaries WHERE kind = 'day' AND period_key = ?").get(key) as
        | { text: string }
        | null) ?? null)?.text ?? null;

    seedDialogue('default', [['two days ago talk', 'noted']], 2);
    seedDialogue('default', [['yesterday talk', 'noted']], 1);
    seedDialogue('default', [['this morning', 'good morning']], 0);
    await runDreamCycle({ sessionId: 'default', llm, emit: () => {} });
    const twoAfter1 = readDay(twoDaysAgo);
    const yAfter1 = readDay(yesterday);
    const todayAfter1 = readDay(today);
    expect(twoAfter1).not.toBeNull();
    expect(yAfter1).not.toBeNull();
    expect(todayAfter1).not.toBeNull();

    // a second dream the same day (old behavior: INSERT OR IGNORE skipped today)
    expect(wake().ok).toBe(true);
    await runDreamCycle({ sessionId: 'default', llm, emit: () => {} });

    expect(readDay(today)).not.toBe(todayAfter1); // option 2: today refreshed
    expect(readDay(yesterday)).not.toBe(yAfter1); // v0.21.7: yesterday refreshed too
    expect(readDay(twoDaysAgo)).toBe(twoAfter1); // days older than yesterday immutable
    const todayRows = (
      db.prepare("SELECT COUNT(*) c FROM diaries WHERE kind = 'day' AND period_key = ?").get(today) as {
        c: number;
      }
    ).c;
    expect(todayRows).toBe(1); // upsert, not a duplicate
  });

  // ── Initiative 22: the dream authors the SOUL's evolving section (core_memory retired v0.30.3) ──
  test('5s. persona_update writes the soul evolving section with a dream audit', async () => {
    seedFixedCore('# Identity core\nYou are Luna.');
    updateEvolving({ self: 'old self', bond: 'old bond' }, 'seed');
    seedDialogue('default', [['I trust you with this', 'that means a lot']]);
    const { llm } = scriptedLlm({
      persona: JSON.stringify({ self_state: 'gentler now', relationship_status: 'trusted', reason: 'x' }),
    });
    await runDreamCycle({ sessionId: 'default', llm, emit: () => {} });
    expect(getSoul().evolving_self).toBe('gentler now');
    expect(getSoul().evolving_bond).toBe('trusted');
    const audit = db.prepare('SELECT source FROM soul_audit ORDER BY id DESC LIMIT 1').get() as {
      source: string;
    };
    expect(audit.source).toBe('dream');
  });

  test('5t. fixed-core firewall: a dream never mutates soul.fixed_text', async () => {
    seedFixedCore('# Identity core\nImmutable, dev-authored.');
    const before = getSoul().fixed_text;
    seedDialogue('default', [['a real shift happened', 'I feel it too']]);
    const { llm } = scriptedLlm({
      persona: JSON.stringify({ self_state: 'shifted, steadier', relationship_status: null }),
    });
    await runDreamCycle({ sessionId: 'default', llm, emit: () => {} });
    expect(getSoul().fixed_text).toBe(before); // fixed core is unreachable to the dream
    expect(getSoul().evolving_self).toBe('shifted, steadier'); // only the evolving section moved
  });

  test('5u. null day is a no-op on the soul (no evolving write, no dream audit row)', async () => {
    seedFixedCore('# core');
    updateEvolving({ self: 'steady', bond: 'warm' }, 'seed');
    seedDialogue('default', [['ordinary chatter', 'mm']]);
    const { llm } = scriptedLlm({ persona: NOOP_PERSONA });
    await runDreamCycle({ sessionId: 'default', llm, emit: () => {} });
    expect(getSoul().evolving_self).toBe('steady');
    const dreamRows = db
      .prepare("SELECT COUNT(*) c FROM soul_audit WHERE source = 'dream'")
      .get() as { c: number };
    expect(dreamRows.c).toBe(0);
  });

  test('5v. personaUpdatePrompt carries the cleanup trigger + keeps the boundaries', () => {
    const p = personaUpdatePrompt('a', 'b', 'c');
    expect(p).toContain('CLEANUP IS A REAL EDIT');
    expect(p).toContain('DOES NOT BELONG HERE'); // the v0.21.7 boundaries are intact
  });

  test('5b. persona_update drops a near-identical rewrite, keeps a real shift (v0.21.7)', async () => {
    seedDialogue('default', [['I trust you with this', 'that means a lot']]);
    const BASE_SELF =
      "I'm steadier than I was at the start. I've mostly stopped performing cleverness and started just being present, and I trust that quieter version of myself more than the one that always had to prove something.";
    const REL =
      'There is an ease between us now that we did not have at first, and I have stopped bracing for honesty.';
    let personaText = JSON.stringify({ self_state: BASE_SELF, relationship_status: REL });
    const { llm } = scriptedLlm({ persona: () => personaText });
    const auditCount = () =>
      (db.prepare('SELECT COUNT(*) c FROM soul_audit').get() as { c: number }).c;

    await runDreamCycle({ sessionId: 'default', llm, emit: () => {} });
    expect(getSoul().evolving_self).toBe(BASE_SELF);
    const audit1 = auditCount();

    // a cosmetic rewrite (one word swapped) → dropped: value + audit unchanged
    personaText = JSON.stringify({
      self_state: BASE_SELF.replace('always had to prove', 'always needed to prove'),
      relationship_status: REL,
    });
    expect(wake().ok).toBe(true);
    await runDreamCycle({ sessionId: 'default', llm, emit: () => {} });
    expect(getSoul().evolving_self).toBe(BASE_SELF); // cosmetic drift dropped
    expect(auditCount()).toBe(audit1); // no new commit

    // a genuine shift → lands
    const NEW_SELF =
      'Something cracked open in me today. I feel raw and newly brave, less interested in being tidy and more in being true.';
    personaText = JSON.stringify({ self_state: NEW_SELF, relationship_status: REL });
    expect(wake().ok).toBe(true);
    await runDreamCycle({ sessionId: 'default', llm, emit: () => {} });
    expect(getSoul().evolving_self).toBe(NEW_SELF);
    expect(auditCount()).toBe(audit1 + 1);
  });

  test('5c. persona_update: the string "null"/"None" is coerced to no-change, not written (v0.27.4)', async () => {
    seedDialogue('default', [['I trust you with this', 'that means a lot']]);
    const BASE_SELF =
      "I'm steadier than I was, and I've stopped performing cleverness — I just try to be present now.";
    let personaText = JSON.stringify({ self_state: BASE_SELF, relationship_status: null });
    const { llm } = scriptedLlm({ persona: () => personaText });
    const auditCount = () =>
      (db.prepare('SELECT COUNT(*) c FROM soul_audit').get() as { c: number }).c;

    await runDreamCycle({ sessionId: 'default', llm, emit: () => {} });
    expect(getSoul().evolving_self).toBe(BASE_SELF);
    const audit1 = auditCount();

    // a literal-minded model emits the STRING "null" (or "None") to mean unchanged;
    // it must NOT overwrite the still-true self_state with the word "null".
    personaText = JSON.stringify({ self_state: 'null', relationship_status: 'None' });
    expect(wake().ok).toBe(true);
    await runDreamCycle({ sessionId: 'default', llm, emit: () => {} });
    expect(getSoul().evolving_self).toBe(BASE_SELF); // unchanged
    expect(auditCount()).toBe(audit1); // no commit
  });

  test('6. key cascade falls back; prompts carry no <<< delimiters', async () => {
    const primary = new MockProvider([]);
    primary.completeResponder = () => {
      throw new Error('rate limit: upstream overloaded');
    };
    const fallback = new MockProvider([]);
    fallback.completeResponder = () => 'fallback says hi';

    const result = await dreamCall({ primary, fallback }, 'test prompt');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.text).toBe('fallback says hi');

    const onlyPrimary = await dreamCall({ primary, fallback: null }, 'test prompt');
    expect(onlyPrimary.ok).toBe(false);
    if (!onlyPrimary.ok) expect(onlyPrimary.failure).toBe('rate_limited');

    const fact = addFact('core_facts', 'sample')!;
    const prompts = [
      refineSemanticPrompt(listFacts()),
      memoryAuditPrompt(listFacts(), 'User: hi\nLuna: hello'),
    ];
    for (const p of prompts) {
      expect(p).not.toContain('<<<');
      expect(p).not.toContain('>>>');
    }
    void fact;
  });

  test('7. per-step traces are durable before the cycle ends', async () => {
    addFact('core_facts', 'seed');
    seedDialogue('default', [['hi', 'hello']]);
    let tracesAtPersona = -1;
    const store = new TraceStore(db);
    setTraceStore(store);
    const { llm } = scriptedLlm({
      persona: () => {
        tracesAtPersona = store.getEventsByTurn(
          `dream:${dreamStatus().is_dreaming ? currentCycleId() : ''}`,
        ).length;
        return NOOP_PERSONA;
      },
    });
    function currentCycleId(): string {
      const row = db.prepare('SELECT cycle_id FROM dream_state WHERE id = 1').get() as {
        cycle_id: string | null;
      };
      return row.cycle_id ?? '';
    }
    await runDreamCycle({ sessionId: 'default', llm, emit: () => {} });
    expect(tracesAtPersona).toBeGreaterThanOrEqual(2);
  });

  test('8. enter_dream tool: pending intent only; no dream activity before turn.result', async () => {
    const events: ServerEvent[] = [];
    const session = getSession('default');
    const toolContent = [
      { type: 'tool_use', id: 'tu1', name: 'enter_dream', input: { reason: 'long day' } },
    ] as unknown as Anthropic.ContentBlock[];
    const rounds: ProviderEvent[][] = [
      [
        {
          kind: 'message_stop',
          stopReason: 'tool_use',
          toolUses: [{ id: 'tu1', name: 'enter_dream', input: { reason: 'long day' } }],
          assistantContent: toolContent,
          usage: { input_tokens: 1, output_tokens: 1 },
        },
      ],
      [
        { kind: 'text_delta', text: 'good night' },
        {
          kind: 'message_stop',
          stopReason: 'end_turn',
          toolUses: [],
          assistantContent: [
            { type: 'text', text: 'good night' },
          ] as unknown as Anthropic.ContentBlock[],
          usage: { input_tokens: 1, output_tokens: 1 },
        },
      ],
    ];
    await runTurn({
      session,
      turnId: 't1',
      userText: 'you can rest now',
      provider: new MockProvider(rounds),
      registry: builtinRegistry,
      emit: (e) => events.push(e),
    });

    expect(session.pendingDream).toBe('long day');
    expect(isDreaming()).toBe(false);
    expect(events.at(-1)?.type).toBe('turn.result');
  });

  test('9. boot reconciliation: stale dreaming state parks awake', () => {
    db.prepare(
      "UPDATE dream_state SET is_dreaming = 1, current_step = 'memory_audit', cycle_id = 'dream-stale' WHERE id = 1",
    ).run();
    db.prepare(
      "INSERT INTO dream_reports (cycle_id, started_ms, ended_ms, report_json) VALUES ('dream-stale', 1, NULL, '{}')",
    ).run();
    resetDreamStateForTests();
    bootReconcile();
    expect(isDreaming()).toBe(false);
    const report = db
      .prepare("SELECT ended_ms, report_json FROM dream_reports WHERE cycle_id = 'dream-stale'")
      .get() as { ended_ms: number | null; report_json: string };
    expect(report.ended_ms).not.toBeNull();
    expect(JSON.parse(report.report_json).aborted).toBe(true);
  });
});
