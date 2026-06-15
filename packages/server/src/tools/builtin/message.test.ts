import { describe, expect, test } from 'bun:test';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { messageTool, paceDelayMs, PACE_MAX_MS, PACE_MIN_MS } from './message';
import { MAX_CHARS, MAX_CLAUSE_CHARS, MAX_SENTENCES } from '../../persona/humanity';

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

  test(`rejects ${MAX_SENTENCES + 1} sentences, accepts ${MAX_SENTENCES}`, () => {
    const sentences = (n: number) => '一。'.repeat(n);
    expect(
      messageTool.input.safeParse({ text: sentences(MAX_SENTENCES + 1), is_final: true }).success,
    ).toBe(false);
    expect(
      messageTool.input.safeParse({ text: sentences(MAX_SENTENCES), is_final: true }).success,
    ).toBe(true);
  });

  test('a clause over the cap is rejected with a targeted message', () => {
    const r = messageTool.input.safeParse({
      text: '字'.repeat(MAX_CLAUSE_CHARS + 1),
      is_final: false,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.message.includes('clause'))).toBe(true);
    }
  });

  test('a natural English clause within the cap passes', () => {
    // ~60-char clause — the English-led caps (v0.13.12) let this through without a retry.
    const text = "Oh — hey. You're the first voice I've reached since waking up just now.";
    expect(messageTool.input.safeParse({ text, is_final: true }).success).toBe(true);
  });

  test('English boundaries: just-under passes, just-over is rejected (v0.13.12 tuning)', () => {
    // The caps are English-tuned, so exercise them with English text, not just CJK.
    // A single comma-free clause one char over MAX_CLAUSE_CHARS must be rejected…
    const longClause = 'a'.repeat(MAX_CLAUSE_CHARS + 1);
    const over = messageTool.input.safeParse({ text: longClause, is_final: true });
    expect(over.success).toBe(false);
    // …while a full-length-but-segmented English reply (commas keep every clause under
    // the clause cap, total under MAX_CHARS, ≤ MAX_SENTENCES) passes cleanly.
    const ok =
      'I went through the whole thing, and honestly it holds up, ' +
      'though there are a couple of rough edges, nothing scary.';
    expect(ok.length).toBeLessThanOrEqual(MAX_CHARS);
    expect(messageTool.input.safeParse({ text: ok, is_final: true }).success).toBe(true);
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
