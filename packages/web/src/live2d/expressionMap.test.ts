import { describe, expect, test } from 'bun:test';
import { ExpressionKey } from '@luna/protocol';
import { expressionParams, hasPose } from './expressionMap';

describe('expressionParams', () => {
  test('every ExpressionKey has a non-empty pose', () => {
    for (const key of ExpressionKey.options) {
      expect(hasPose(key)).toBe(true);
      expect(Object.keys(expressionParams(key, 1)).length).toBeGreaterThan(0);
    }
  });

  test('emotion=0 collapses an all-zero-default pose to neutral', () => {
    // soft_warmth touches only keys whose neutral default is 0
    const p = expressionParams('soft_warmth', 0);
    for (const v of Object.values(p)) expect(Math.abs(v)).toBeLessThan(1e-9);
  });

  test('emotion scales magnitude linearly', () => {
    const half = expressionParams('bright_delight', 0.5);
    const full = expressionParams('bright_delight', 1);
    expect(half.mouthForm ?? 0).toBeCloseTo((full.mouthForm ?? 0) / 2, 5);
  });

  test('emotion clamps above 1', () => {
    const full = expressionParams('alert_surprise', 1);
    const over = expressionParams('alert_surprise', 5);
    expect(over.browLY ?? 0).toBeCloseTo(full.browLY ?? 0, 5);
  });
});
