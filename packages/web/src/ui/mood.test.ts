import { describe, expect, test } from 'bun:test';
import { ExpressionKey } from '@luna/protocol';
import { moodOf } from './mood';

describe('moodOf', () => {
  test('every ExpressionKey has a non-empty emoji + label', () => {
    for (const key of ExpressionKey.options) {
      const m = moodOf(key);
      expect(m.emoji.length).toBeGreaterThan(0);
      expect(m.label.length).toBeGreaterThan(0);
    }
  });
});
