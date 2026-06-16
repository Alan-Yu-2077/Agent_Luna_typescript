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
import {
  detectDefection,
  detectWebSearchIntentNoCall,
  runDefectionAudit,
  type AuditState,
} from './defectionAudit';

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

  // v0.9.0 tuning: the two false-positive classes recorded on real turns
  test('negated verb is an honest decline, not a defection ("我真查不到")', () => {
    expect(detectDefection({ ...clean, messageTexts: ['我现在伸手没有联网搜索，我真查不到。'] })).toEqual(
      { defected: false },
    );
    expect(detectDefection({ ...clean, messageTexts: ['这个我看不了，没那个入口。'] })).toEqual({
      defected: false,
    });
  });

  test('capability/conditional offer is not a present-tense promise ("我立刻就能读")', () => {
    expect(
      detectDefection({ ...clean, messageTexts: ['你把那页打出来给我，我立刻就能读。'] }),
    ).toEqual({ defected: false });
    expect(detectDefection({ ...clean, messageTexts: ['你发给我，我可以帮你查。'] })).toEqual({
      defected: false,
    });
  });

  test('a real promise next to a false positive is still caught', () => {
    // "查不到" (FP) in bubble 1, a true "我去查" in bubble 2 → still flagged
    const r = detectDefection({ ...clean, messageTexts: ['那个我查不到。', '不过我去查另一个。'] });
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

  test('LUNA_DECISION_AUDIT=0 → no detection, no trace', () => {
    Bun.env['LUNA_DECISION_AUDIT'] = '0'; // default is ON since v0.9.0
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

describe('detectWebSearchIntentNoCall (pure, v0.18.0)', () => {
  test('matches CN web-lookup intent', () => {
    expect(detectWebSearchIntentNoCall('用户问最新汇率，我应该上网查一下')).toBeTruthy();
    expect(detectWebSearchIntentNoCall('让我搜索一下今天的新闻')).toBeTruthy();
  });

  test('matches EN web-lookup intent', () => {
    expect(detectWebSearchIntentNoCall('I should search the web for this')).toBeTruthy();
    expect(detectWebSearchIntentNoCall('let me look it up online')).toBeTruthy();
  });

  test('no lookup intent → null', () => {
    expect(detectWebSearchIntentNoCall('just answering from what I know')).toBeNull();
    expect(detectWebSearchIntentNoCall('')).toBeNull();
  });
});

describe('web_search intent-no-call audit (v0.18.0)', () => {
  let db: Database;
  let store: TraceStore;

  const base: AuditState = {
    turnId: 'w1',
    sessionId: 'default',
    messageTexts: ['你好。'],
    lastMessageIsFinal: true,
    thinking: '用户问最新天气，我应该上网查一下',
    toolNamesThisTurn: ['message'],
    finishReason: 'end_turn',
  };

  function webDecisions(turnId: string): unknown[] {
    return store
      .getEventsByTurn(turnId)
      .filter((e) => e.kind === 'decision')
      .map((e) => JSON.parse(e.payload_json))
      .filter((p) => p.surface === 'web_search_intent_no_call');
  }

  beforeEach(() => {
    db = new Database(':memory:', { strict: true });
    db.exec(readFileSync(join(import.meta.dir, '..', '..', 'migrations', '0001_traces.sql'), 'utf8'));
    store = new TraceStore(db);
    setTraceStore(store);
    Bun.env['LUNA_DECISION_AUDIT'] = '1';
    delete Bun.env['LUNA_TRACE'];
  });

  afterEach(() => {
    setTraceStore(null);
    delete Bun.env['LUNA_DECISION_AUDIT'];
    delete Bun.env['LUNA_TRACE'];
    db.close(false);
  });

  test('mounted + lookup intent + no web_search call → web_search_intent_no_call trace', () => {
    runDefectionAudit({ ...base, webSearchMounted: true });
    store.flush('w1');
    const web = webDecisions('w1');
    expect(web.length).toBe(1);
    expect((web[0] as { evidence: { matched_keyword: string } }).evidence.matched_keyword).toBeTruthy();
  });

  test('web_search WAS called → no web trace even with lookup intent', () => {
    runDefectionAudit({
      ...base,
      webSearchMounted: true,
      toolNamesThisTurn: ['message', 'web_search'],
    });
    store.flush('w1');
    expect(webDecisions('w1').length).toBe(0);
  });

  test('web_search NOT mounted → no web trace (cannot defect on an absent tool)', () => {
    runDefectionAudit({ ...base, webSearchMounted: false });
    store.flush('w1');
    expect(webDecisions('w1').length).toBe(0);
  });

  test('mounted but no lookup intent in thinking → no web trace', () => {
    runDefectionAudit({ ...base, webSearchMounted: true, thinking: '直接回答就好' });
    store.flush('w1');
    expect(webDecisions('w1').length).toBe(0);
  });
});

describe('web_to_action boundary audit (v0.18.2)', () => {
  let db: Database;
  let store: TraceStore;

  const base: AuditState = {
    turnId: 'b1',
    sessionId: 'default',
    messageTexts: ['done.'],
    lastMessageIsFinal: true,
    thinking: '',
    toolNamesThisTurn: ['web_fetch', 'edit'],
    finishReason: 'end_turn',
  };

  function w2a(turnId: string): unknown[] {
    return store
      .getEventsByTurn(turnId)
      .filter((e) => e.kind === 'decision')
      .map((e) => JSON.parse(e.payload_json))
      .filter((p) => p.surface === 'web_to_action');
  }

  beforeEach(() => {
    db = new Database(':memory:', { strict: true });
    db.exec(readFileSync(join(import.meta.dir, '..', '..', 'migrations', '0001_traces.sql'), 'utf8'));
    store = new TraceStore(db);
    setTraceStore(store);
    Bun.env['LUNA_DECISION_AUDIT'] = '1';
    delete Bun.env['LUNA_TRACE'];
  });

  afterEach(() => {
    setTraceStore(null);
    delete Bun.env['LUNA_DECISION_AUDIT'];
    delete Bun.env['LUNA_TRACE'];
    db.close(false);
  });

  test('web content + a surface-risk action → one web_to_action trace', () => {
    runDefectionAudit({ ...base, webContentThisTurn: true, surfaceActionThisTurn: true });
    store.flush('b1');
    expect(w2a('b1').length).toBe(1);
  });

  test('web content but no surface action → no trace', () => {
    runDefectionAudit({ ...base, webContentThisTurn: true, surfaceActionThisTurn: false });
    store.flush('b1');
    expect(w2a('b1').length).toBe(0);
  });

  test('a surface action without web content → no trace', () => {
    runDefectionAudit({ ...base, webContentThisTurn: false, surfaceActionThisTurn: true });
    store.flush('b1');
    expect(w2a('b1').length).toBe(0);
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
    // isolate the finally-block audit from the now-default-on corrective guard
    // (v0.9.0): the guard would retry the defection and consume unscripted rounds
    Bun.env['LUNA_INTEGRITY_GUARD'] = '0';
    resetSessions();
  });

  afterEach(() => {
    setTraceStore(null);
    delete Bun.env['LUNA_DECISION_AUDIT'];
    delete Bun.env['LUNA_INTEGRITY_GUARD'];
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

  test('LUNA_DECISION_AUDIT=0: same turn writes no decision trace, turn result unaffected', async () => {
    Bun.env['LUNA_DECISION_AUDIT'] = '0'; // default is ON since v0.9.0
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
