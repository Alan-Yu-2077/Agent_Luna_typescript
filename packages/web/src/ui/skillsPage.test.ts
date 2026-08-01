import { describe, expect, test } from 'bun:test';
import type { SkillRecord } from '@luna/protocol';
import { groupSkills, relativeTime, selfTaught } from './skillsPage';

const skill = (over: Partial<SkillRecord>): SkillRecord => ({
  name: 'x',
  description: 'd',
  body: 'b',
  used_count: 0,
  last_used_ms: 0,
  verified_ms: 1,
  source: 'saved',
  deprecated_ms: 0,
  ...over,
});

describe('groupSkills — the shelf order (v0.44.4)', () => {
  test('alive ones first by recency of use; the retired fold below by retirement date', () => {
    const groups = groupSkills([
      skill({ name: 'old', last_used_ms: 100 }),
      skill({ name: 'fresh', last_used_ms: 900 }),
      skill({ name: 'gone-late', deprecated_ms: 500 }),
      skill({ name: 'gone-early', deprecated_ms: 200 }),
    ]);
    expect(groups.active.map((s) => s.name)).toEqual(['fresh', 'old']);
    expect(groups.retired.map((s) => s.name)).toEqual(['gone-late', 'gone-early']);
  });

  test('an empty library groups to two empty shelves, not a crash', () => {
    expect(groupSkills([])).toEqual({ active: [], retired: [] });
  });
});

// M9: which ones she taught HERSELF is the interesting part of this page.
describe('selfTaught', () => {
  test('saved and dream are hers; anything else was installed', () => {
    expect(selfTaught('saved')).toBe(true);
    expect(selfTaught('dream')).toBe(true);
    expect(selfTaught('owner')).toBe(false);
    expect(selfTaught('builtin')).toBe(false);
  });
});

describe('relativeTime', () => {
  const now = 10 * 24 * 60 * 60_000; // an arbitrary fixed clock
  test('the three bands read naturally', () => {
    expect(relativeTime(now - 30_000, now)).toBe('刚刚');
    expect(relativeTime(now - 5 * 60_000, now)).toBe('5 分钟前');
    expect(relativeTime(now - 3 * 60 * 60_000, now)).toBe('3 小时前');
    expect(relativeTime(now - 2 * 24 * 60 * 60_000, now)).toBe('2 天前');
  });

  test('never used says so instead of pretending an epoch date', () => {
    expect(relativeTime(0, now)).toBe('还没用过');
  });

  test('a clock skew cannot produce a negative age', () => {
    expect(relativeTime(now + 60_000, now)).toBe('刚刚');
  });
});
