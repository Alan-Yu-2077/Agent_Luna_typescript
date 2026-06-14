import { describe, expect, test } from 'bun:test';
import { ExpressionKey } from '@luna/protocol';
import { affectToEmotion } from './expressionMap';
import { EMOTIONS } from './faceData';

describe('affectToEmotion', () => {
  test('every affect maps to a defined emotion or null (baseline)', () => {
    for (const key of ExpressionKey.options) {
      const id = affectToEmotion(key);
      if (id !== null) expect(EMOTIONS[id]).toBeDefined();
    }
  });

  test('steady_presence is the baseline (no emotion)', () => {
    expect(affectToEmotion('steady_presence')).toBeNull();
  });

  test('representative mappings', () => {
    expect(affectToEmotion('shy_softness')).toBe('shy');
    expect(affectToEmotion('annoyed_resistance')).toBe('annoyed');
    expect(affectToEmotion('bright_delight')).toBe('adorable');
    expect(affectToEmotion('focused_engagement')).toBe('focused');
  });
});
