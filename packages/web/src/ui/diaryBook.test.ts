import { describe, expect, test } from 'bun:test';
import type { DiaryEntry, DreamRecord } from '@luna/protocol';
import {
  buildBookIndex,
  createTurnQueue,
  DREAM_BROKE,
  dreamNarrative,
  localDayKey,
  monthGrid,
  nextLitDay,
  pageHeading,
  translateStep,
} from './diaryBook';

const diary = (period_key: string): DiaryEntry => ({
  kind: 'day',
  period_key,
  text: 't',
  generated_ms: 1,
});
const dream = (started_ms: number, over: Partial<DreamRecord> = {}): DreamRecord => ({
  cycle_id: `c${started_ms}`,
  started_ms,
  ended_ms: null,
  steps: [],
  aborted: false,
  ...over,
});

describe('buildBookIndex — the calendar lights exactly what exists (M8)', () => {
  test('skip-day diaries light their own days and nothing between', () => {
    const idx = buildBookIndex([diary('2026-07-31'), diary('2026-07-25'), diary('2026-07-23')], []);
    expect(idx.litDays).toEqual(['2026-07-31', '2026-07-25', '2026-07-23']);
    expect(idx.diaryCount).toBe(3);
  });

  test('week/month digests have no day to sit on and stay off the calendar', () => {
    const idx = buildBookIndex(
      [diary('2026-07-31'), { kind: 'week', period_key: '2026-W30', text: 'w', generated_ms: 1 }],
      [],
    );
    expect(idx.litDays).toEqual(['2026-07-31']);
    expect(idx.diaryCount).toBe(1);
  });

  test('a dream lands on its LOCAL start day, and a dream-only day is lit too', () => {
    const noon = new Date(2026, 6, 20, 12, 0, 0).getTime(); // July 20 local
    const idx = buildBookIndex([], [dream(noon)]);
    expect(idx.litDays).toEqual(['2026-07-20']);
    expect(idx.days.get('2026-07-20')?.dreams.length).toBe(1);
    expect(localDayKey(noon)).toBe('2026-07-20');
  });

  test('a day with both carries both', () => {
    const noon = new Date(2026, 6, 25, 22, 30).getTime();
    const idx = buildBookIndex([diary('2026-07-25')], [dream(noon)]);
    const day = idx.days.get('2026-07-25');
    expect(day?.diary).toBeDefined();
    expect(day?.dreams.length).toBe(1);
  });
});

describe('monthGrid', () => {
  test('July 2026 lays out with its real weekday offset and 31 days', () => {
    const idx = buildBookIndex([diary('2026-07-25')], []);
    const cells = monthGrid(2026, 6, idx);
    const firstDay = new Date(2026, 6, 1).getDay();
    expect(cells.slice(0, firstDay).every((c) => c.day === null)).toBe(true);
    expect(cells.filter((c) => c.day !== null).length).toBe(31);
    const the25th = cells.find((c) => c.day === 25);
    expect(the25th?.hasDiary).toBe(true);
    expect(cells.find((c) => c.day === 24)?.hasDiary).toBe(false);
  });

  test('diary and dream marks are independent flags on the same cell', () => {
    const noon = new Date(2026, 6, 25, 3, 0).getTime();
    const idx = buildBookIndex([diary('2026-07-25')], [dream(noon)]);
    const cell = monthGrid(2026, 6, idx).find((c) => c.day === 25);
    expect(cell).toMatchObject({ hasDiary: true, hasDream: true });
  });
});

describe('nextLitDay — arrows travel lit days only', () => {
  const lit = ['2026-07-31', '2026-07-25', '2026-07-23'];
  test('moves and clamps at the ends', () => {
    expect(nextLitDay(lit, '2026-07-31', 1)).toBe('2026-07-25');
    expect(nextLitDay(lit, '2026-07-23', 1)).toBe('2026-07-23');
    expect(nextLitDay(lit, '2026-07-31', -1)).toBe('2026-07-31');
  });
  test('an unknown current lands on the newest', () => {
    expect(nextLitDay(lit, 'nowhere', 1)).toBe('2026-07-31');
  });
  test('an empty book has nowhere to go', () => {
    expect(nextLitDay([], 'x', 1)).toBeNull();
  });
});

// The wording is a first draft for the owner (README OQ1) — what the tests pin is the CONTRACT:
// counts extracted, actions stated, no feelings ascribed, unknown steps degrade to themselves.
describe('the dream translation layer (M10)', () => {
  test('the real pipeline steps read as what she did that night', () => {
    expect(
      translateStep({ step: 'rate_salience', status: 'ok', detail: 'rated 9 turns', ms: 1 }),
    ).toBe('回看了 9 个瞬间。');
    expect(
      translateStep({ step: 'refine_semantic', status: 'ok', detail: 'removed 2, added 2', ms: 1 }),
    ).toBe('放下了 2 件事，记住了 2 件。');
    expect(
      translateStep({ step: 'memory_audit', status: 'ok', detail: 'removed 0, added 3', ms: 1 }),
    ).toBe('整理了记忆的抽屉（−0 / +3）。');
    expect(
      translateStep({ step: 'persona_update', status: 'ok', detail: 'self+bond', ms: 1 }),
    ).toBe('对自己的认识动了动（self+bond）。');
    expect(
      translateStep({ step: 'run_diaries', status: 'ok', detail: '2 diaries written', ms: 1 }),
    ).toBe('写下了 2 篇日记。');
    expect(
      translateStep({
        step: 'distill_skills',
        status: 'ok',
        detail: 'new:live2d-gesture-control',
        ms: 1,
      }),
    ).toBe('学会了一件新事：live2d-gesture-control。');
  });

  test('a skipped fold reads as the plan wrote it', () => {
    expect(
      translateStep({ step: 'refine_layer1', status: 'skipped', detail: 'nothing to fold', ms: 1 }),
    ).toBe('略过——没什么要折叠的。');
  });

  test('an unknown step renders raw — a future dream stage must not crash the book', () => {
    expect(translateStep({ step: 'new_stage', status: 'ok', detail: 'did a thing', ms: 1 })).toBe(
      'new_stage: did a thing',
    );
  });

  test('the timings never surface — the pipeline cost is not part of her night', () => {
    const line = translateStep({
      step: 'rate_salience',
      status: 'ok',
      detail: 'rated 9 turns',
      ms: 99999,
    });
    expect(line).not.toContain('99999');
  });

  test('aborted and empty dreams both read as a broken dream', () => {
    expect(dreamNarrative(dream(1, { aborted: true }))).toEqual({
      broken: true,
      lines: [DREAM_BROKE],
    });
    expect(dreamNarrative(dream(1, { steps: [] }))).toEqual({ broken: true, lines: [DREAM_BROKE] });
    const full = dreamNarrative(
      dream(1, {
        steps: [{ step: 'rate_salience', status: 'ok', detail: 'rated 3 turns', ms: 1 }],
      }),
    );
    expect(full.broken).toBe(false);
    expect(full.lines).toEqual(['回看了 3 个瞬间。']);
  });
});

describe('the page-turn queue — one turn at a time, latest click wins', () => {
  test('a click mid-turn queues; the queued target runs after; no stacking', () => {
    const turns: string[] = [];
    let finish: (() => void) | null = null;
    const q = createTurnQueue((to, done) => {
      turns.push(to);
      finish = done;
    });
    q.request('a');
    expect(turns).toEqual(['a']);
    expect(q.turning()).toBe(true);
    q.request('b');
    q.request('c'); // b is superseded — the reader pointed at c LAST
    expect(turns).toEqual(['a']);
    finish!();
    expect(turns).toEqual(['a', 'c']);
    finish!();
    expect(q.turning()).toBe(false);
  });
});

describe('pageHeading', () => {
  test('reads like a diary date', () => {
    expect(pageHeading('2026-07-31')).toBe('2026年7月31日');
    expect(pageHeading('2026-01-05')).toBe('2026年1月5日');
  });
});
