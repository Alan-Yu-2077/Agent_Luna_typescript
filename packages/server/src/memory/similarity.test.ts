import { describe, expect, test } from 'bun:test';
import { similarityRatio } from './similarity';

describe('similarityRatio (v0.21.7 core-memory churn gate)', () => {
  test('identical → 1', () => {
    expect(similarityRatio('hello world', 'hello world')).toBe(1);
  });

  test('empty vs non-empty → 0 (a first establishment always counts as a change)', () => {
    expect(similarityRatio('', 'something')).toBe(0);
    expect(similarityRatio('something', '')).toBe(0);
  });

  test('a single-word edit in a long sentence scores near 1 (cosmetic drift)', () => {
    const a = 'the quick brown fox jumps over the lazy dog and keeps on running';
    const b = 'the quick brown fox jumps over the lazy dog and keeps on jogging';
    expect(similarityRatio(a, b)).toBeGreaterThan(0.9);
  });

  test('wholly different prose scores low (a genuine shift)', () => {
    const a = 'I feel steadier and more present than I used to be';
    const b = 'Sam plays a roguelike and studies for an exam between board-game nights';
    expect(similarityRatio(a, b)).toBeLessThan(0.5);
  });
});
