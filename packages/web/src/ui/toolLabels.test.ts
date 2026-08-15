import { describe, expect, test } from 'bun:test';
import { toolCardLabel } from './toolLabels';

describe('toolCardLabel', () => {
  test('recall (started) → cute label', () =>
    expect(toolCardLabel('🔧 recall…')).toBe('翻了翻记忆 🔖'));
  test('read_file (started) → cute label', () =>
    expect(toolCardLabel('🔧 read_file…')).toBe('读了点东西 📖'));
  test('enter_dream → cute label', () =>
    expect(toolCardLabel('🔧 enter_dream…')).toBe('准备进入梦境 🌙'));
  test('unknown summary → stripped passthrough', () =>
    expect(toolCardLabel('🔧 2 hits')).toBe('2 hits'));

  // v0.20.9 — exact match, not substring: the old includes() mislabeled these.
  test('recall_skill (started) → its OWN cute label (not recall)', () =>
    expect(toolCardLabel('🔧 recall_skill…')).toBe('回忆起一项技能 💡'));
  test('propose_self_edit (started) → its OWN label (not edit)', () =>
    expect(toolCardLabel('🔧 propose_self_edit…')).toBe('提出了一次自我修改 ✍️'));
  test('a finish summary containing a tool-name substring is NOT rewritten', () =>
    expect(toolCardLabel('🔧 edited memory/recall.ts (1 replacements)')).toBe(
      'edited memory/recall.ts (1 replacements)',
    ));
});
