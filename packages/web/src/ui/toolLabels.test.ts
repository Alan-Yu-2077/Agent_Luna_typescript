import { describe, expect, test } from 'bun:test';
import { toolCardLabel } from './toolLabels';

describe('toolCardLabel', () => {
  test('recall (started) → cute label', () =>
    expect(toolCardLabel('🔧 recall…')).toBe('flipped through memories 🔖'));
  test('read_file (started) → cute label', () =>
    expect(toolCardLabel('🔧 read_file…')).toBe('read something 📖'));
  test('enter_dream → cute label', () =>
    expect(toolCardLabel('🔧 enter_dream…')).toBe('getting ready to dream 🌙'));
  test('unknown summary → stripped passthrough', () =>
    expect(toolCardLabel('🔧 2 hits')).toBe('2 hits'));
});
