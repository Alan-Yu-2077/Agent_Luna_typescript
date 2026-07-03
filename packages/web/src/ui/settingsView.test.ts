import { describe, expect, test } from 'bun:test';
import type { Setting } from '@luna/protocol';
import { groupByCategory } from './settingsView';

function s(key: string, category: string): Setting {
  return {
    key,
    label: key,
    hint: '',
    category,
    kind: 'boolean',
    value: '1',
    source: 'default',
    restart_required: false,
  };
}

describe('settingsView grouping', () => {
  test('groups preserve server order for categories AND items', () => {
    const grouped = groupByCategory([
      s('a', 'Companion'),
      s('b', 'Perception'),
      s('c', 'Companion'),
      s('d', 'Model'),
    ]);
    expect(grouped.map(([name]) => name)).toEqual(['Companion', 'Perception', 'Model']);
    expect(grouped[0]?.[1].map((x) => x.key)).toEqual(['a', 'c']);
  });

  test('empty input renders no groups', () => {
    expect(groupByCategory([])).toEqual([]);
  });
});
