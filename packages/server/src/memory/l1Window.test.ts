import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type Anthropic from '@anthropic-ai/sdk';
import { MockProvider } from '../provider/mock';
import type { ProviderEvent } from '../provider/types';
import { builtinRegistry } from '../tools/registry';
import { getSession, resetSessions } from '../turn/session';
import { runTurn } from '../turn/runTurn';
import { appendL2, setMemoryDb, persistSession, loadSession } from './sessionStore';
import { buildActiveContext, maybeFold, planFold } from './l1Window';

let db: Database;

beforeEach(() => {
  db = new Database(':memory:', { strict: true });
  for (const f of ['0002_memory.sql', '0003_l1_window.sql']) {
    db.exec(readFileSync(join(import.meta.dir, '..', 'migrations', f), 'utf8'));
  }
  setMemoryDb(db);
  resetSessions();
  delete Bun.env['LUNA_L1_WINDOW'];
});

afterEach(() => {
  setMemoryDb(null);
  db.close(false);
  resetSessions();
  delete Bun.env['LUNA_L1_WINDOW'];
});

// Seeds N simple turns: history gets [user, assistant] pairs; L2 gets matching rows.
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

describe('l1Window', () => {
  test('1. bounded: 40 turns → active context stays under keep + summary', async () => {
    seedTurns('s', 40);
    const session = getSession('s');
    const provider = new MockProvider([]);
    await maybeFold(session, provider);

    const ctx = buildActiveContext(session);
    expect(ctx.length).toBeLessThan(80);
    expect(ctx.length).toBeLessThanOrEqual(24 + 1);
    const first = ctx[0];
    expect(JSON.stringify(first?.content)).toContain('conversation_summary');
  });

  test('2. no-re-compression: second fold input excludes first summary text', async () => {
    seedTurns('s', 40);
    const session = getSession('s');
    const provider = new MockProvider([]);
    provider.completeResponder = () => 'SUMMARY_ONE_MARKER';
    await maybeFold(session, provider);
    expect(session.rollingSummary).toContain('SUMMARY_ONE_MARKER');

    seedTurns('s', 20, 40);
    provider.completeResponder = () => 'SUMMARY_TWO';
    await maybeFold(session, provider);

    expect(provider.completeRequests.length).toBe(2);
    const secondInput = JSON.stringify(provider.completeRequests[1]?.messages);
    expect(secondInput).not.toContain('SUMMARY_ONE_MARKER');
    expect(secondInput).toContain('question 4');
  });

  test('3. deterministic: same L2 state → identical fold input', () => {
    seedTurns('s', 40);
    const session = getSession('s');
    const planA = planFold(session);
    const planB = planFold(session);
    expect(planA).not.toBeNull();
    expect(planA?.foldText).toBe(planB!.foldText);
    expect(planA?.newLowWater).toBe(planB!.newLowWater);
  });

  test('4. LUNA_L1_WINDOW=0 → full history passthrough', async () => {
    seedTurns('s', 40);
    const session = getSession('s');
    await maybeFold(session, new MockProvider([]));
    expect(session.windowLowWater).toBeGreaterThan(0);

    Bun.env['LUNA_L1_WINDOW'] = '0';
    const ctx = buildActiveContext(session);
    expect(ctx.length).toBe(session.history.length);
  });

  test('5. fold never blocks a new turn; in-flight fold lands cleanly after', async () => {
    seedTurns('s', 40);
    const session = getSession('s');

    let releaseFold: (v: string) => void;
    const gate = new Promise<string>((r) => {
      releaseFold = r;
    });
    const foldProvider = new MockProvider([]);
    foldProvider.completeResponder = () => gate;
    const foldPromise = maybeFold(session, foldProvider);

    const text = [{ type: 'text', text: 'hi' }] as unknown as Anthropic.ContentBlock[];
    const turnRounds: ProviderEvent[][] = [
      [
        { kind: 'text_delta', text: 'hi' },
        {
          kind: 'message_stop',
          stopReason: 'end_turn',
          toolUses: [],
          assistantContent: text,
          usage: { input_tokens: 1, output_tokens: 1 },
        },
      ],
    ];
    const liveProvider = new MockProvider(turnRounds);
    liveProvider.completeResponder = () => new Promise<string>(() => {});
    const state = await runTurn({
      session,
      turnId: 'live',
      userText: 'hello while folding',
      provider: liveProvider,
      registry: builtinRegistry,
      emit: () => {},
    });
    expect(state.finishReason).toBe('end_turn');

    releaseFold!('LATE_SUMMARY');
    const landed = await foldPromise;
    expect(landed).toBe(true);
    expect(session.rollingSummary).toContain('LATE_SUMMARY');
    expect(loadSession('s')?.rollingSummary).toContain('LATE_SUMMARY');
  });

  test('6. CAS: stale fold discards (changes === 0)', async () => {
    seedTurns('s', 40);
    const session = getSession('s');

    let release: (v: string) => void;
    const gate = new Promise<string>((r) => {
      release = r;
    });
    const slowProvider = new MockProvider([]);
    slowProvider.completeResponder = () => gate;
    const slowFold = maybeFold(session, slowProvider);

    const fastProvider = new MockProvider([]);
    fastProvider.completeResponder = () => 'FAST_WINNER';
    const fastLanded = await maybeFold(session, fastProvider);
    expect(fastLanded).toBe(true);

    release!('SLOW_LOSER');
    const slowLanded = await slowFold;
    expect(slowLanded).toBe(false);
    expect(session.rollingSummary).toContain('FAST_WINNER');
    expect(session.rollingSummary).not.toContain('SLOW_LOSER');
  });
});
