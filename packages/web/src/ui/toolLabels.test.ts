import { describe, expect, test } from 'bun:test';
import { toolCardLabel } from './toolLabels';

describe('toolCardLabel', () => {
  test('recall (started) → cute label', () =>
    expect(toolCardLabel('🔧 recall…')).toBe('翻了翻记忆 🔖'));
  test('read_file (started) → cute label', () =>
    expect(toolCardLabel('🔧 read_file…')).toBe('读了点东西 📖'));
  test('enter_dream → cute label', () =>
    expect(toolCardLabel('🔧 enter_dream…')).toBe('准备做个梦 🌙'));
  test('unknown summary → stripped passthrough', () =>
    expect(toolCardLabel('🔧 2 hits')).toBe('2 hits'));
});
