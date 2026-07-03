import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import type Anthropic from '@anthropic-ai/sdk';
import { MockProvider } from '../provider/mock';
import { getSession, resetSessions } from '../turn/session';
import { migrate } from '../sql';
import { appendL2, setImportance, setMemoryDb, persistSession, loadSession } from './sessionStore';
import { buildActiveContext, hardTrimTail, maybeFold, planFold } from './l1Window';

let db: Database;

// Small window so a modest seed triggers folding (default is 100 turns).
beforeEach(() => {
  db = new Database(':memory:', { strict: true });
  migrate(db, join(import.meta.dir, '..', 'migrations'));
  setMemoryDb(db);
  resetSessions();
  delete Bun.env['LUNA_L1_WINDOW'];
  Bun.env['LUNA_L1_RECENT_TURNS'] = '10';
  Bun.env['LUNA_L1_FOLD_BATCH_TURNS'] = '2';
});

afterEach(() => {
  setMemoryDb(null);
  db.close(false);
  resetSessions();
  delete Bun.env['LUNA_L1_WINDOW'];
  delete Bun.env['LUNA_L1_RECENT_TURNS'];
  delete Bun.env['LUNA_L1_FOLD_BATCH_TURNS'];
  delete Bun.env['LUNA_L1_SUMMARY_MAX_CHARS'];
});

// Seeds N turns: history gets [user, assistant] pairs; L2 gets matching rows.
function seedTurns(sessionId: string, n: number, startIdx = 0): void {
  const session = getSession(sessionId);
  for (let i = startIdx; i < startIdx + n; i++) {
    const userMsg: Anthropic.MessageParam = { role: 'user', content: `question ${i}` };
    const asstMsg: Anthropic.MessageParam = { role: 'assistant', content: `answer ${i}` };
    session.history.push(userMsg, asstMsg);
    appendL2({
      sessionId,
      turnId: `t${i}`,
      userText: `question ${i}`,
      assistantText: `answer ${i}`,
      rawContent: [userMsg, asstMsg],
    });
  }
  persistSession(sessionId, session.history, startIdx + n);
}

describe('l1Window — turns unit (v0.17.0)', () => {
  test('1. bounded: folds down to RECENT_TURNS verbatim + a digest', async () => {
    seedTurns('s', 20); // > 10 + 2 → folds
    const session = getSession('s');
    await maybeFold(session, new MockProvider([]));

    const ctx = buildActiveContext(session);
    // 10 turns × 2 messages + 1 digest message
    expect(ctx.length).toBeLessThanOrEqual(10 * 2 + 1);
    expect(JSON.stringify(ctx[0]?.content)).toContain('conversation_summary');
  });

  test('2. oscillating compression: the second fold folds the PRIOR digest in, bounded', async () => {
    seedTurns('s', 20);
    const session = getSession('s');
    const provider = new MockProvider([]);
    provider.completeResponder = () => 'DIGEST_ONE_MARKER';
    await maybeFold(session, provider);
    expect(session.rollingSummary).toBe('DIGEST_ONE_MARKER');

    seedTurns('s', 12, 20);
    provider.completeResponder = () => 'DIGEST_TWO';
    await maybeFold(session, provider);

    expect(provider.completeRequests.length).toBe(2);
    const secondInput = JSON.stringify(provider.completeRequests[1]?.messages);
    // v0.17.0: unlike the old append-only summary, the compressor RECEIVES the
    // prior digest and re-derives a bounded one.
    expect(secondInput).toContain('DIGEST_ONE_MARKER');
    expect(session.rollingSummary).toBe('DIGEST_TWO'); // replaced, not appended
  });

  // v0.20.6 — an empty/truncated complete() digest must not overwrite a real
  // rolling summary with '' nor advance the low-water mark.
  test('an empty digest does NOT overwrite the rolling summary or advance low-water', async () => {
    seedTurns('s', 20);
    const session = getSession('s');
    const provider = new MockProvider([]);
    provider.completeResponder = () => 'REAL_DIGEST';
    await maybeFold(session, provider);
    expect(session.rollingSummary).toBe('REAL_DIGEST');
    const lowWater = session.windowLowWater;

    seedTurns('s', 12, 20);
    provider.completeResponder = () => '   '; // trims to '' (truncated / all-thinking)
    const landed = await maybeFold(session, provider);
    expect(landed).toBe(false);
    expect(session.rollingSummary).toBe('REAL_DIGEST'); // preserved
    expect(session.windowLowWater).toBe(lowWater); // not advanced
  });

  test('3. structured digest is hard-capped (no unbounded growth)', async () => {
    Bun.env['LUNA_L1_SUMMARY_MAX_CHARS'] = '50';
    seedTurns('s', 20);
    const session = getSession('s');
    const provider = new MockProvider([]);
    provider.completeResponder = () => 'x'.repeat(500); // over the cap
    await maybeFold(session, provider);
    expect(session.rollingSummary.length).toBe(50);
  });

  test('4. importance anchors: a salient folded turn is marked [salient] to the compressor', async () => {
    seedTurns('s', 20);
    // rate turn 0 (the oldest, which will be folded) as highly salient
    const row0 = db.prepare("SELECT id FROM l2_turns WHERE turn_id = 't0'").get() as { id: number };
    setImportance(row0.id, 5);

    const session = getSession('s');
    const provider = new MockProvider([]);
    provider.completeResponder = () => 'D';
    await maybeFold(session, provider);

    const input = JSON.stringify(provider.completeRequests[0]?.messages);
    expect(input).toContain('[salient] User: question 0');
    expect(input).not.toContain('[salient] User: question 9'); // unrated → not marked
  });

  test('5. planFold deterministic + reports the folded turns', () => {
    seedTurns('s', 20);
    const session = getSession('s');
    const a = planFold(session);
    const b = planFold(session);
    expect(a).not.toBeNull();
    expect(a?.folded.length).toBe(10); // 20 − RECENT_TURNS(10)
    expect(a?.newLowWater).toBe(b!.newLowWater);
  });

  test('6. no fold below the window+batch threshold', () => {
    seedTurns('s', 11); // 11 ≤ 10 + 2 → no fold
    expect(planFold(getSession('s'))).toBeNull();
  });

  test('7. LUNA_L1_WINDOW=0 → full history passthrough', async () => {
    seedTurns('s', 20);
    const session = getSession('s');
    await maybeFold(session, new MockProvider([]));
    expect(session.windowLowWater).toBeGreaterThan(0);

    Bun.env['LUNA_L1_WINDOW'] = '0';
    expect(buildActiveContext(session).length).toBe(session.history.length);
  });

  // v0.28.4 regression — the 390K-token-turn incident: a watermark that no longer lands on an L2
  // row boundary (history edits shift message counts) must HEAL and keep folding, not stall forever.
  test('9. drifted watermark heals: fold proceeds from the nearest row boundary', async () => {
    seedTurns('s', 20);
    const session = getSession('s');
    // corrupt the watermark to mid-row (rows are 2 messages; 3 is inside row 1)
    session.windowLowWater = 3;
    db.run('UPDATE sessions SET window_low_water = 3 WHERE id = ?', ['s']);

    const plan = planFold(session);
    expect(plan).not.toBeNull(); // old code: null forever
    // healed base = 4 (the boundary just crossed); fold 8 turns (18 unfolded − keep 10) × 2 msgs
    expect(plan!.newLowWater).toBe(4 + 8 * 2);

    const provider = new MockProvider([]);
    provider.completeResponder = () => 'HEALED_DIGEST';
    expect(await maybeFold(session, provider)).toBe(true);
    expect(session.windowLowWater).toBe(20); // row-aligned again
    expect(loadSession('s')?.windowLowWater).toBe(20);
    // the active context is bounded again: digest + 10 verbatim turns
    const ctx = buildActiveContext(session);
    expect(ctx.length).toBe(1 + 10 * 2);
  });

  test('10. hard trim bounds the tail even when folding is stalled', () => {
    Bun.env['LUNA_L1_TAIL_MAX_MSGS'] = '8';
    try {
      seedTurns('s', 30);
      const session = getSession('s'); // windowLowWater 0, never folded
      const ctx = buildActiveContext(session);
      expect(ctx.length).toBeLessThanOrEqual(8);
      // the cut lands on a turn start, not mid-turn
      expect(ctx[0]?.role).toBe('user');
      expect(JSON.stringify(ctx[0]?.content)).toContain('question');
    } finally {
      delete Bun.env['LUNA_L1_TAIL_MAX_MSGS'];
    }
  });

  test('11. hardTrimTail cuts at turn starts and never strands a tool_result', () => {
    const msgs: Anthropic.MessageParam[] = [];
    for (let i = 0; i < 6; i++) {
      msgs.push(
        { role: 'user', content: `q${i}` },
        {
          role: 'assistant',
          content: [{ type: 'tool_use', id: `u${i}`, name: 'read_file', input: {} }],
        },
        {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: `u${i}`, content: 'data' }],
        },
        { role: 'assistant', content: `a${i}` },
      );
    }
    const trimmed = hardTrimTail(msgs, 10, 1_000_000);
    expect(trimmed.length).toBeLessThanOrEqual(10);
    const first = trimmed[0]!;
    expect(first.role).toBe('user');
    expect(JSON.stringify(first.content)).not.toContain('tool_result');
    // every tool_result in the trimmed slice has its tool_use present
    const text = JSON.stringify(trimmed);
    for (const m of trimmed) {
      if (!Array.isArray(m.content)) continue;
      for (const b of m.content) {
        if (b.type === 'tool_result') expect(text).toContain(`"id":"${b.tool_use_id}"`);
      }
    }
  });

  test('12. hardTrimTail char budget: one oversized turn falls back to the last turn start', () => {
    const msgs: Anthropic.MessageParam[] = [
      { role: 'user', content: 'small q' },
      { role: 'assistant', content: 'small a' },
      { role: 'user', content: 'big q' },
      { role: 'assistant', content: 'x'.repeat(5000) }, // alone over the budget below
    ];
    const trimmed = hardTrimTail(msgs, 100, 1000);
    // keeps the final (oversized) turn whole rather than returning everything
    expect(trimmed.length).toBe(2);
    expect(trimmed[0]?.content).toBe('big q');
  });

  test('13. a drifted tail start inside a tool pair aligns to the next turn start', () => {
    const session = getSession('s');
    session.history.push(
      { role: 'user', content: 'q0' },
      { role: 'assistant', content: [{ type: 'tool_use', id: 'u1', name: 'read_file', input: {} }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'u1', content: 'data' }] },
      { role: 'assistant', content: 'a0' },
      { role: 'user', content: 'q1' },
      { role: 'assistant', content: 'a1' },
    );
    session.rollingSummary = 'D';
    session.windowLowWater = 2; // points AT the tool_result message (mid-pair)
    const ctx = buildActiveContext(session);
    expect(JSON.stringify(ctx)).not.toContain('tool_result'); // dangling pair dropped
    expect(JSON.stringify(ctx[1]?.content)).toContain('q1'); // aligned to the next turn start
  });

  test('8. CAS: stale fold discards (replace semantics)', async () => {
    seedTurns('s', 20);
    const session = getSession('s');

    let release: (v: string) => void;
    const gate = new Promise<string>((r) => {
      release = r;
    });
    const slow = new MockProvider([]);
    slow.completeResponder = () => gate;
    const slowFold = maybeFold(session, slow);

    const fast = new MockProvider([]);
    fast.completeResponder = () => 'FAST_WINNER';
    expect(await maybeFold(session, fast)).toBe(true);

    release!('SLOW_LOSER');
    expect(await slowFold).toBe(false);
    expect(session.rollingSummary).toBe('FAST_WINNER');
    expect(loadSession('s')?.rollingSummary).toBe('FAST_WINNER');
  });
});
