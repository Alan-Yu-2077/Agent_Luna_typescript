import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import type Anthropic from '@anthropic-ai/sdk';
import { MockProvider } from '../provider/mock';
import type { ProviderEvent } from '../provider/types';
import { builtinRegistry } from '../tools/registry';
import { getSession, resetSessions } from './session';
import { runTurn } from './runTurn';
import { migrate } from '../sql';
import { setMemoryDb } from '../memory/sessionStore';
import { renderL1Contract } from '../persona/l1Contract';
import {
  buildTimeBlock,
  classifyDaypart,
  classifyGap,
  formatGap,
  relativeLabel,
  type Daypart,
} from './temporalContext';

describe('formatGap', () => {
  test.each([
    [0, 'just now'],
    [90, '1m'],
    [4320, '1h 12m'],
    [180000, '2 days'],
  ])('%d s → %s', (sec, expected) => {
    expect(formatGap(sec)).toBe(expected);
  });
});

describe('classifyDaypart', () => {
  test.each<[number, Daypart]>([
    [2, 'late night'],
    [9, 'morning'],
    [14, 'afternoon'],
    [21, 'evening'],
  ])('hour %d → %s', (h, expected) => {
    expect(classifyDaypart(h)).toBe(expected);
  });
});

describe('classifyGap (gap + calendar-day flag)', () => {
  test('< continuation, same clock → continuation', () => {
    expect(classifyGap(300, false)).toBe('continuation');
  });
  test('2h same calendar day → same_day', () => {
    expect(classifyGap(7200, false)).toBe('same_day');
  });
  test('20h crossing midnight → new_day (NOT same_day despite < 24h)', () => {
    expect(classifyGap(72000, true)).toBe('new_day');
  });
  test('> 1 day → long_away', () => {
    expect(classifyGap(90000, false)).toBe('long_away');
  });
  test('null → first', () => {
    expect(classifyGap(null, false)).toBe('first');
  });
});

describe('relativeLabel (local calendar, tz-explicit)', () => {
  const now = Date.UTC(2026, 5, 17, 14, 0); // 17th 14:00 UTC
  test.each([
    [now - 120_000, 'just now'],
    [Date.UTC(2026, 5, 17, 8, 0), 'this morning'],
    [Date.UTC(2026, 5, 16, 14, 0), 'yesterday'],
    [Date.UTC(2026, 5, 14, 14, 0), '3 days ago'],
    [Date.UTC(2026, 5, 7, 14, 0), 'on 2026-06-07'],
  ])('%d → %s', (tMs, expected) => {
    expect(relativeLabel(tMs, now, 'UTC')).toBe(expected);
  });
});

describe('buildTimeBlock', () => {
  const now = Date.UTC(2026, 5, 17, 6, 32); // 14:32 Asia/Shanghai
  test('renders day-of-week, ISO date, tz offset, gap, bucket', () => {
    const block = buildTimeBlock({
      nowMs: now,
      lastInteractionMs: now - 4320 * 1000,
      sessionStartMs: now - 7380 * 1000,
      tz: 'Asia/Shanghai',
    });
    expect(block).toContain('Wednesday, 2026-06-17 14:32 (Asia/Shanghai, UTC+8) — afternoon');
    expect(block).toContain('Since the last message: 1h 12m (same day — still this afternoon)');
    expect(block).toContain('This session: started 2h 3m ago');
  });
  test('first contact when no last interaction', () => {
    const block = buildTimeBlock({
      nowMs: now,
      lastInteractionMs: null,
      sessionStartMs: now,
      tz: 'UTC',
    });
    expect(block).toContain('Since the last message: first contact');
  });
});

describe('L1 time clause', () => {
  test('present iff timeAware', () => {
    expect(renderL1Contract(false, false, true)).toContain('never compute');
    expect(renderL1Contract(false, false, false)).not.toContain('how long ago');
  });
});

describe('placement (cache safety)', () => {
  let db: Database;
  beforeEach(() => {
    db = new Database(':memory:', { strict: true });
    migrate(db, join(import.meta.dir, '..', 'migrations'));
    setMemoryDb(db);
    resetSessions();
  });
  afterEach(() => {
    setMemoryDb(null);
    db.close(false);
    resetSessions();
    delete Bun.env['LUNA_TIME_AWARE'];
  });

  function endRound(text: string): ProviderEvent[] {
    return [
      {
        kind: 'message_stop',
        stopReason: 'end_turn',
        toolUses: [],
        assistantContent: [{ type: 'text', text }] as unknown as Anthropic.ContentBlock[],
        usage: { input_tokens: 1, output_tokens: 1 },
      },
    ];
  }

  test('time facts in the uncached user message; system block byte-stable across turns', async () => {
    Bun.env['LUNA_TIME_AWARE'] = '1';
    const session = getSession('t');
    const provider = new MockProvider([endRound('a'), endRound('b')]);
    await runTurn({
      session,
      turnId: 't1',
      userText: 'hi',
      provider,
      registry: builtinRegistry,
      emit: () => {},
    });
    await runTurn({
      session,
      turnId: 't2',
      userText: 'yo',
      provider,
      registry: builtinRegistry,
      emit: () => {},
    });

    const sys = (r: number): string => JSON.stringify(provider.requests[r]?.system);
    // cached prefix is byte-identical across turns (per-turn time facts are NOT in it)
    expect(sys(0)).toBe(sys(1));
    expect(sys(0)).not.toContain('Current time (you are handed this');

    // the per-turn time facts ride the latest user message
    const userMsg = provider.requests[0]?.messages.at(-1);
    const blocks = userMsg?.content as Anthropic.TextBlockParam[];
    expect(blocks.some((b) => b.text.includes('Current time (you are handed this'))).toBe(true);
  });

  test('flag off → no time block anywhere', async () => {
    delete Bun.env['LUNA_TIME_AWARE'];
    const session = getSession('t');
    const provider = new MockProvider([endRound('a')]);
    await runTurn({
      session,
      turnId: 't1',
      userText: 'hi',
      provider,
      registry: builtinRegistry,
      emit: () => {},
    });
    const userMsg = provider.requests[0]?.messages.at(-1);
    const blocks = userMsg?.content as Anthropic.TextBlockParam[];
    expect(blocks.some((b) => b.text.includes('Current time'))).toBe(false);
    expect(JSON.stringify(provider.requests[0]?.system)).not.toContain('never compute');
  });
});
