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

  // v0.20.9 — exact match, not substring: the old includes() mislabeled these.
  test('recall_skill (started) → its OWN cute label (not recall)', () =>
    expect(toolCardLabel('🔧 recall_skill…')).toBe('recalled a skill 💡'));
  test('propose_self_edit (started) → its OWN label (not edit)', () =>
    expect(toolCardLabel('🔧 propose_self_edit…')).toBe('proposed a self-edit ✍️'));
  test('a finish summary containing a tool-name substring is NOT rewritten', () =>
    expect(toolCardLabel('🔧 edited memory/recall.ts (1 replacements)')).toBe(
      'edited memory/recall.ts (1 replacements)',
    ));
});
