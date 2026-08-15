import { describe, expect, test } from 'bun:test';
import { absoluteTime, dateLabel, relativeTime } from './time';

const NOW = new Date(2026, 5, 14, 14, 32).getTime();

describe('relativeTime', () => {
  test('<60s → 刚刚', () => expect(relativeTime(NOW, NOW - 10_000)).toBe('刚刚'));
  test('200s → 3 分钟前', () => expect(relativeTime(NOW, NOW - 200_000)).toBe('3 分钟前'));
  test('2h → 2 小时前', () => expect(relativeTime(NOW, NOW - 2 * 3_600_000)).toBe('2 小时前'));
  test('≥24h → M/D date label', () =>
    expect(relativeTime(NOW, NOW - 2 * 86_400_000)).toMatch(/^\d{1,2}\/\d{1,2}$/));
  test('future time clamps to 刚刚', () => expect(relativeTime(NOW, NOW + 5_000)).toBe('刚刚'));
});

describe('absoluteTime / dateLabel', () => {
  test('HH:MM zero-padded', () => {
    expect(absoluteTime(new Date(2026, 5, 14, 9, 5).getTime())).toBe('09:05');
  });
  test('dateLabel is M/D', () => {
    expect(dateLabel(new Date(2026, 5, 14, 9, 5).getTime())).toBe('6/14');
  });
});
