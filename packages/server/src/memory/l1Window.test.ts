import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import type Anthropic from '@anthropic-ai/sdk';
import { MockProvider } from '../provider/mock';
import { getSession, resetSessions } from '../turn/session';
import { migrate } from '../sql';
import { appendL2, setImportance, setMemoryDb, persistSession, loadSession } from './sessionStore';
import { buildActiveContext, maybeFold, planFold } from './l1Window';

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
