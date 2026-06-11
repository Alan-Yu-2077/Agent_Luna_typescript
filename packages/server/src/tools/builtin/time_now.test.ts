import { describe, expect, test } from 'bun:test';
import { timeNowTool } from './time_now';

describe('time_now', () => {
  test('yields ok with iso, unix_ms, tz', async () => {
    const ctx = {
      sessionId: 'test',
      callId: 'c1',
      abortSignal: new AbortController().signal,
    };
    const events: unknown[] = [];
    for await (const e of timeNowTool.execute({}, ctx)) {
      events.push(e);
    }
    expect(events.length).toBe(1);
    const e = events[0] as { kind: string; data: { iso: string; unix_ms: number; tz: string } };
    expect(e.kind).toBe('ok');
    expect(typeof e.data.iso).toBe('string');
    expect(typeof e.data.unix_ms).toBe('number');
    expect(typeof e.data.tz).toBe('string');
    expect(e.data.tz.length).toBeGreaterThan(0);
    expect(Math.abs(e.data.unix_ms - Date.now())).toBeLessThan(100);
  });

  test('summarize includes iso and tz', () => {
    const summary = timeNowTool.summarize({
      iso: '2026-06-11T10:00:00.000Z',
      unix_ms: 1781272800000,
      tz: 'Asia/Shanghai',
    });
    expect(summary).toContain('2026-06-11');
    expect(summary).toContain('Asia/Shanghai');
  });
});
