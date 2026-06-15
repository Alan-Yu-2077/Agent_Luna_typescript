import { describe, expect, test } from 'bun:test';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { messageTool, paceDelayMs, PACE_MAX_MS, PACE_MIN_MS } from './message';
import { MAX_CHARS } from '../../persona/humanity';

const ctx = () => ({
  sessionId: 'test',
  callId: 'c1',
  abortSignal: new AbortController().signal,
});

async function run(input: unknown): Promise<{ kind: string; data?: Record<string, unknown> }> {
  const events: unknown[] = [];
  for await (const e of messageTool.execute(input, ctx())) events.push(e);
  return events[0] as { kind: string; data?: Record<string, unknown> };
}

describe('message input schema (humanity caps as Zod)', () => {
  test('accepts a clean short message with all optional fields', () => {
    const r = messageTool.input.safeParse({
      text: '小猫第一次看见雪，跳了起来。',
      expression: 'bright_delight',
      emotion: 0.8,
      voice_params: { provider: 'gpt-sovits', voice: 'luna' },
      is_final: true,
    });
    expect(r.success).toBe(true);
  });

  test(`rejects text over ${MAX_CHARS} chars`, () => {
    const r = messageTool.input.safeParse({ text: '啊'.repeat(MAX_CHARS + 1), is_final: true });
    expect(r.success).toBe(false);
  });

  test('rejects 5 sentences (CJK), accepts 4', () => {
    expect(
      messageTool.input.safeParse({ text: '一。二。三。四。五。', is_final: true }).success,
    ).toBe(false);
    expect(
      messageTool.input.safeParse({ text: '一。二。三。四。', is_final: true }).success,
    ).toBe(true);
  });

  test('a clause over the cap is rejected with a targeted message', () => {
    const r = messageTool.input.safeParse({ text: '字'.repeat(91), is_final: false }); // > 90 cap
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.message.includes('clause'))).toBe(true);
    }
  });

  test('an English clause within the cap passes (the 55→90 fix)', () => {
    // longest clause ~60 chars — failed the CJK-tuned 55 cap, passes 90
    const text = "Oh — hey. You're the first voice I've reached since waking up just now.";
    expect(messageTool.input.safeParse({ text, is_final: true }).success).toBe(true);
  });

  test('emotion outside [0,1] rejected; missing is_final rejected', () => {
    expect(
      messageTool.input.safeParse({ text: 'hi', emotion: 1.2, is_final: true }).success,
    ).toBe(false);
    expect(messageTool.input.safeParse({ text: 'hi' }).success).toBe(false);
  });

  test('wire schema is a flat root object (gateway rule)', () => {
    const raw = zodToJsonSchema(messageTool.input, { $refStrategy: 'none' }) as Record<
      string,
      unknown
    >;
    expect(raw['type']).toBe('object');
    expect('properties' in raw).toBe(true);
    expect('anyOf' in raw).toBe(false);
  });
});

describe('message execute (delivery envelope)', () => {
  test('derives segments with pacing metadata', async () => {
    const e = await run({ text: '你好。今天的雪很大，我有点想出去看看！', is_final: true });
    expect(e.kind).toBe('ok');
    const segments = e.data?.['segments'] as { index: number; text: string; delay_ms: number }[];
    expect(segments.length).toBe(2);
    expect(segments[0]).toEqual({ index: 0, text: '你好', delay_ms: PACE_MIN_MS });
    expect(segments[1]!.text).toBe('今天的雪很大，我有点想出去看看');
    expect(segments[1]!.delay_ms).toBe(paceDelayMs('今天的雪很大，我有点想出去看看'));
    expect(e.data?.['is_final']).toBe(true);
    expect(e.data?.['expression']).toBeUndefined();
  });

  test('pacing clamps: floor and ceiling', () => {
    expect(paceDelayMs('嗯')).toBe(PACE_MIN_MS);
    expect(paceDelayMs('字'.repeat(100))).toBe(PACE_MAX_MS);
  });

  test('passes expression/emotion/voice_params through the envelope', async () => {
    const e = await run({
      text: '我在呢',
      expression: 'soft_warmth',
      emotion: 0.5,
      voice_params: { voice: 'luna' },
      is_final: false,
    });
    expect(e.data?.['expression']).toBe('soft_warmth');
    expect(e.data?.['emotion']).toBe(0.5);
    expect(e.data?.['voice_params']).toEqual({ voice: 'luna' });
    expect(e.data?.['is_final']).toBe(false);
  });

  test('summarize truncates to 30 chars', () => {
    expect(messageTool.summarize({ text: '字'.repeat(40), segments: [], is_final: true })).toBe(
      '字'.repeat(30),
    );
  });
});
