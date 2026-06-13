import { describe, expect, test } from 'bun:test';
import { MockProvider } from '../provider/mock';
import type { DreamLLM } from '../dream/llm';
import { buildWakeContext, wakeGate } from './wakeGate';

function llmReturning(text: string): DreamLLM {
  const p = new MockProvider([]);
  p.completeResponder = () => text;
  return { primary: p, fallback: null };
}

function llmThrowing(): DreamLLM {
  const p = new MockProvider([]);
  p.completeResponder = () => {
    throw new Error('boom');
  };
  return { primary: p, fallback: null };
}

describe('wakeGate (bounded judgment, fail-closed)', () => {
  test('act:true with intent parses', async () => {
    const v = await wakeGate(
      llmReturning('{"act": true, "intent": "reflect", "reason": "quiet moment"}'),
      'ctx',
    );
    expect(v.act).toBe(true);
    expect(v.intent).toBe('reflect');
  });

  test('act:false parses', async () => {
    const v = await wakeGate(llmReturning('{"act": false, "reason": "nothing to do"}'), 'ctx');
    expect(v.act).toBe(false);
  });

  test('JSON embedded in prose is extracted', async () => {
    const v = await wakeGate(
      llmReturning('Let me think... {"act": true, "intent": "recall", "reason": "x"} done'),
      'ctx',
    );
    expect(v.act).toBe(true);
    expect(v.intent).toBe('recall');
  });

  test('unparseable output → fail closed (no wake)', async () => {
    const v = await wakeGate(llmReturning('I think maybe yes?'), 'ctx');
    expect(v.act).toBe(false);
    expect(v.reason).toContain('unparseable');
  });

  test('invalid intent → fail closed', async () => {
    const v = await wakeGate(llmReturning('{"act": true, "intent": "destroy", "reason": "x"}'), 'ctx');
    expect(v.act).toBe(false);
  });

  test('provider failure → fail closed', async () => {
    const v = await wakeGate(llmThrowing(), 'ctx');
    expect(v.act).toBe(false);
    expect(v.reason).toContain('judgment_');
  });
});

describe('buildWakeContext', () => {
  test('includes gap + daypart; lists recent proactive messages', () => {
    const c = buildWakeContext({
      gapLabel: '2 hours',
      daypart: 'evening',
      recentProactive: ['想到你了', '还在忙吗'],
    });
    expect(c).toContain('2 hours');
    expect(c).toContain('evening');
    expect(c).toContain('想到你了');
  });
  test('omits the recent block when none', () => {
    const c = buildWakeContext({ gapLabel: '1 hour', daypart: 'morning', recentProactive: [] });
    expect(c).not.toContain('do not repeat');
  });
});
