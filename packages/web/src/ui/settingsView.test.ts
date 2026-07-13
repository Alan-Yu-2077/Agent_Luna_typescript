import { describe, expect, test } from 'bun:test';
import type { Setting } from '@luna/protocol';
import { formatSliderValue, groupByCategory } from './settingsView';

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

describe('formatSliderValue (v0.36.4 slider chip)', () => {
  test('passes a clean integer through', () => {
    expect(formatSliderValue('7')).toBe('7');
  });
  test('rounds a long fractional drag to 2 dp', () => {
    expect(formatSliderValue('3.500001')).toBe('3.5');
    expect(formatSliderValue('0.6666666')).toBe('0.67');
  });
  test('non-numeric text falls through unchanged', () => {
    expect(formatSliderValue('auto')).toBe('auto');
  });
});
