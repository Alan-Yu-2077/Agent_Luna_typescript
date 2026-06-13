import { describe, expect, test } from 'bun:test';
import { DecisionTraceEvent, TraceEvent } from './trace';

const base = {
  schema_v: 1 as const,
  trace_id: 't1',
  turn_id: 't1',
  session_id: 'default',
  t_ms: 123,
};

describe('DecisionTraceEvent (v0.8.0 wire contract)', () => {
  test('parses a full decision event with evidence', () => {
    const r = DecisionTraceEvent.safeParse({
      ...base,
      kind: 'decision',
      surface: 'intent_no_act',
      decision: 'defected',
      reason: '我去查',
      evidence: { kind: 'message_intent', matched: '我去查', called_tools: ['message'] },
    });
    expect(r.success).toBe(true);
  });

  test('evidence is optional', () => {
    const r = DecisionTraceEvent.safeParse({
      ...base,
      kind: 'decision',
      surface: 'intent_no_act',
      decision: 'defected',
      reason: 'is_final:false',
    });
    expect(r.success).toBe(true);
  });

  test('rejects missing required fields', () => {
    expect(
      DecisionTraceEvent.safeParse({ ...base, kind: 'decision', surface: 'x', decision: 'y' })
        .success,
    ).toBe(false);
  });

  test('the TraceEvent union routes kind:"decision" to the decision variant', () => {
    const r = TraceEvent.safeParse({
      ...base,
      kind: 'decision',
      surface: 'intent_no_act',
      decision: 'defected',
      reason: 'r',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.kind).toBe('decision');
  });
});
