import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type Anthropic from '@anthropic-ai/sdk';
import type { ServerEvent } from '@luna/protocol';
import { MockProvider } from '../../provider/mock';
import type { ProviderEvent } from '../../provider/types';
import { messageRegistry } from '../../tools/registry';
import { getSession, resetSessions } from '../session';
import { runTurn } from '../runTurn';
import type { TraceEvent } from '@luna/protocol';
import { TraceStore } from '../../trace/store';
import { setTraceStore } from '../../trace/instrument';
import { detectDefection, runDefectionAudit, type AuditState } from './defectionAudit';

// Throws only on the decision-trace write — simulates a DB error isolated to
// that record. Exercises the sole guard of override-not-depend (the catch in
// runDefectionAudit), which is load-bearing because the audit runs
// synchronously in runTurn's finally before flushTrace.
class DecisionThrowingStore extends TraceStore {
  override record(event: TraceEvent): void {
    if (event.kind === 'decision') throw new Error('boom: decision write failed');
    super.record(event);
  }
}

describe('detectDefection (pure, zero-LLM)', () => {
  const clean = {
    messageTexts: ['你好。'],
    lastIsFinal: true,
    thinking: '',
    calledToolNames: ['message'],
    finishReason: 'end_turn',
  };

  test('is_final:false then clean end → is_final_promise (highest confidence)', () => {
    const r = detectDefection({ ...clean, lastIsFinal: false });
    expect(r).toEqual({ defected: true, kind: 'is_final_promise', matched: 'is_final:false' });
  });

  test('is_final_promise does NOT fire when the harness stopped the turn', () => {
    expect(detectDefection({ ...clean, lastIsFinal: false, finishReason: 'max_iterations' })).toEqual({
      defected: false,
    });
  });

  test('delivered message promises an act, no non-message tool fired → message_intent', () => {
    const r = detectDefection({ ...clean, messageTexts: ['我马上去查一下天气。'] });
    expect(r.defected).toBe(true);
    if (r.defected) {
      expect(r.kind).toBe('message_intent');
      expect(r.matched).toBeTruthy();
    }
  });

  test('English promise matched too', () => {
    const r = detectDefection({ ...clean, messageTexts: ["Sure, I'll check that for you."] });
    expect(r.defected).toBe(true);
    if (r.defected) expect(r.kind).toBe('message_intent');
  });

  test('promised AND a real tool fired → not a defection', () => {
    const r = detectDefection({
      ...clean,
      messageTexts: ['我去查一下。'],
      calledToolNames: ['message', 'read_file'],
    });
    expect(r).toEqual({ defected: false });
  });

  test('thinking promises but message did not → thinking_intent (audit-only tier)', () => {
    const r = detectDefection({ ...clean, thinking: '用户问天气，我应该用工具查一下。' });
    expect(r.defected).toBe(true);
    if (r.defected) expect(r.kind).toBe('thinking_intent');
  });

  test('is_final_promise outranks message_intent when both apply', () => {
    const r = detectDefection({ ...clean, messageTexts: ['我去查。'], lastIsFinal: false });
    if (r.defected) expect(r.kind).toBe('is_final_promise');
  });

  test('clean spoken turn → not defected', () => {
    expect(detectDefection(clean)).toEqual({ defected: false });
  });

  test('no messages, no promise → not defected (null lastIsFinal)', () => {
    expect(
      detectDefection({ messageTexts: [], lastIsFinal: null, thinking: '', calledToolNames: [], finishReason: 'end_turn' }),
    ).toEqual({ defected: false });
  });

  test('promise split across bubbles still caught (per-bubble match)', () => {
    const r = detectDefection({ ...clean, messageTexts: ['好的。', '我去查一下。'] });
    expect(r.defected).toBe(true);
    if (r.defected) expect(r.kind).toBe('message_intent');
  });
});

describe('runDefectionAudit (gated trace write)', () => {
  let db: Database;
  let store: TraceStore;

  const defectingState: AuditState = {
    turnId: 'a1',
    sessionId: 'default',
    messageTexts: ['我马上去查。'],
    lastMessageIsFinal: true,
    thinking: '',
    toolNamesThisTurn: ['message'],
    finishReason: 'end_turn',
  };

  beforeEach(() => {
    db = new Database(':memory:', { strict: true });
    db.exec(readFileSync(join(import.meta.dir, '..', '..', 'migrations', '0001_traces.sql'), 'utf8'));
    store = new TraceStore(db);
    setTraceStore(store);
    delete Bun.env['LUNA_TRACE'];
  });

  afterEach(() => {
    setTraceStore(null);
    delete Bun.env['LUNA_DECISION_AUDIT'];
    delete Bun.env['LUNA_TRACE'];
    db.close(false);
  });

  test('flag off → no detection, no trace', () => {
    delete Bun.env['LUNA_DECISION_AUDIT'];
    expect(runDefectionAudit(defectingState)).toEqual({ defected: false });
    store.flush('a1');
    expect(store.getEventsByTurn('a1').length).toBe(0);
  });

  test('flag on + defection → exactly one decision trace with evidence', () => {
    Bun.env['LUNA_DECISION_AUDIT'] = '1';
    const r = runDefectionAudit(defectingState);
    expect(r.defected).toBe(true);
    store.flush('a1');
    const rows = store.getEventsByTurn('a1').filter((e) => e.kind === 'decision');
    expect(rows.length).toBe(1);
    const payload = JSON.parse(rows[0]!.payload_json);
    expect(payload.surface).toBe('intent_no_act');
    expect(payload.evidence.kind).toBe('message_intent');
  });

  test('flag on + clean turn → no decision trace', () => {
    Bun.env['LUNA_DECISION_AUDIT'] = '1';
    runDefectionAudit({ ...defectingState, messageTexts: ['你好呀。'] });
    store.flush('a1');
    expect(store.getEventsByTurn('a1').filter((e) => e.kind === 'decision').length).toBe(0);
  });

  test('override-not-depend: a throwing trace write is swallowed → {defected:false}, never propagates', () => {
    Bun.env['LUNA_DECISION_AUDIT'] = '1';
    setTraceStore(new DecisionThrowingStore(db));
    let result: ReturnType<typeof runDefectionAudit> | undefined;
    expect(() => {
      result = runDefectionAudit(defectingState);
    }).not.toThrow();
    // detection said "defected", but the trace write threw → caught → no-op result
    expect(result).toEqual({ defected: false });
  });
});

function stopWithMessages(calls: { id: string; input: unknown }[]): ProviderEvent {
  const toolUses = calls.map((c) => ({ id: c.id, name: 'message', input: c.input }));
  return {
    kind: 'message_stop',
    stopReason: 'tool_use',
    toolUses,
    assistantContent: toolUses.map((t) => ({
      type: 'tool_use',
      id: t.id,
      name: t.name,
      input: t.input,
    })) as unknown as Anthropic.ContentBlock[],
    usage: { input_tokens: 10, output_tokens: 5 },
  };
}

const stopEnd: ProviderEvent = {
  kind: 'message_stop',
  stopReason: 'end_turn',
  toolUses: [],
  assistantContent: [] as unknown as Anthropic.ContentBlock[],
  usage: { input_tokens: 5, output_tokens: 1 },
};

describe('defection audit through runTurn (end-to-end)', () => {
  let db: Database;
  let store: TraceStore;

  beforeEach(() => {
    db = new Database(':memory:', { strict: true });
    db.exec(readFileSync(join(import.meta.dir, '..', '..', 'migrations', '0001_traces.sql'), 'utf8'));
    store = new TraceStore(db);
    setTraceStore(store);
    delete Bun.env['LUNA_TRACE'];
    resetSessions();
  });

  afterEach(() => {
    setTraceStore(null);
    delete Bun.env['LUNA_DECISION_AUDIT'];
    delete Bun.env['LUNA_TRACE'];
    db.close(false);
  });

  async function turn(turnId: string, provider: MockProvider): Promise<ServerEvent[]> {
    const events: ServerEvent[] = [];
    await runTurn({
      session: getSession('default'),
      turnId,
      userText: '天气怎么样',
      provider,
      registry: messageRegistry,
      emit: (e) => events.push(e),
    });
    return events;
  }

  test('flag on: a "我去查" message with no tool call lands a decision trace, atomic with the turn', async () => {
    Bun.env['LUNA_DECISION_AUDIT'] = '1';
    const provider = new MockProvider([
      [stopWithMessages([{ id: 'm1', input: { text: '我马上去查一下天气。', is_final: true } }])],
      [stopEnd],
    ]);
    await turn('t1', provider);
    // flushTrace already ran inside runTurn's finally — rows are persisted
    const decisions = store.getEventsByTurn('t1').filter((e) => e.kind === 'decision');
    expect(decisions.length).toBe(1);
    expect(JSON.parse(decisions[0]!.payload_json).evidence.kind).toBe('message_intent');
  });

  test('flag off (default): same turn writes no decision trace, turn result unaffected', async () => {
    delete Bun.env['LUNA_DECISION_AUDIT'];
    const provider = new MockProvider([
      [stopWithMessages([{ id: 'm1', input: { text: '我马上去查一下天气。', is_final: true } }])],
      [stopEnd],
    ]);
    const events = await turn('t2', provider);
    expect(store.getEventsByTurn('t2').filter((e) => e.kind === 'decision').length).toBe(0);
    expect(events.find((e) => e.type === 'turn.result')).toBeTruthy();
  });

  test('flag on: a clean answer with no promise writes no decision trace', async () => {
    Bun.env['LUNA_DECISION_AUDIT'] = '1';
    const provider = new MockProvider([
      [stopWithMessages([{ id: 'm1', input: { text: '今天晴，挺暖和的。', is_final: true } }])],
      [stopEnd],
    ]);
    await turn('t3', provider);
    expect(store.getEventsByTurn('t3').filter((e) => e.kind === 'decision').length).toBe(0);
  });

  test('override-not-depend (end-to-end): a throwing decision write never breaks the turn', async () => {
    Bun.env['LUNA_DECISION_AUDIT'] = '1';
    setTraceStore(new DecisionThrowingStore(db));
    const provider = new MockProvider([
      [stopWithMessages([{ id: 'm1', input: { text: '我马上去查一下天气。', is_final: true } }])],
      [stopEnd],
    ]);
    let events: ServerEvent[] = [];
    await expect((async () => {
      events = await turn('t4', provider);
    })()).resolves.toBeUndefined();
    // the turn still finalized despite the decision-write throw in finally
    expect(events.find((e) => e.type === 'turn.result')).toBeTruthy();
    // and the turn's own (non-decision) traces still flushed
    expect(store.getEventsByTurn('t4').some((e) => e.kind === 'node')).toBe(true);
  });
});
