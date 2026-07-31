import { describe, expect, test } from 'bun:test';
import { ExpressionKey } from '@luna/protocol';
import { AFFECT_TO_EMOTION, affectToEmotion, reachableEmotions } from './expressionMap';
import { EMOTIONS } from './faceData';

describe('affectToEmotion', () => {
  test('every affect maps to a defined emotion or null (baseline)', () => {
    for (const key of ExpressionKey.options) {
      for (const intensity of [undefined, 0, 0.5, 1]) {
        const id = affectToEmotion(key, intensity);
        if (id !== null) expect(EMOTIONS[id]).toBeDefined();
      }
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

  test('the table covers the wire contract exactly — no missing key, no invented one', () => {
    expect(Object.keys(AFFECT_TO_EMOTION).sort()).toEqual([...ExpressionKey.options].sort());
  });
});

// --- v0.43.2: the vocabulary is wide enough to read as different feelings ------------------------

describe('coverage — no hand-authored clip is left on the shelf', () => {
  test('all 14 clips are reachable', () => {
    const reachable = reachableEmotions();
    const orphans = Object.keys(EMOTIONS).filter((id) => !reachable.has(id as never));
    expect(orphans).toEqual([]);
  });

  test('the four that were previously unreachable are the point of this version', () => {
    const reachable = reachableEmotions();
    for (const id of ['fakeFierce', 'embarrassed', 'poutyAnnoyed', 'disappointed']) {
      expect(`${id}:${reachable.has(id as never)}`).toBe(`${id}:true`);
    }
  });

  test('the vocabulary yields at least 13 distinct faces', () => {
    // Was 10 before this version — three affects collapsed onto `curious`, three onto `tender`.
    expect(reachableEmotions().size).toBeGreaterThanOrEqual(13);
  });
});

describe('intensity branching', () => {
  test('a branched affect performs two genuinely different clips', () => {
    expect(affectToEmotion('guarded_distance', 0.3)).toBe('skeptical');
    expect(affectToEmotion('guarded_distance', 0.9)).toBe('fakeFierce');
    expect(affectToEmotion('annoyed_resistance', 0.3)).toBe('annoyed');
    expect(affectToEmotion('annoyed_resistance', 0.9)).toBe('poutyAnnoyed');
    expect(affectToEmotion('awkward_lightness', 0.3)).toBe('awkwardV2');
    expect(affectToEmotion('awkward_lightness', 0.9)).toBe('embarrassed');
    expect(affectToEmotion('gentle_concern', 0.3)).toBe('tender');
    expect(affectToEmotion('gentle_concern', 0.9)).toBe('disappointed');
  });

  test('an unbranched affect ignores intensity entirely', () => {
    for (const k of ['bright_delight', 'shy_softness', 'amused_smirk', 'playful_brightness'] as const) {
      expect(affectToEmotion(k, 0.1)).toBe(affectToEmotion(k, 1));
    }
  });

  test('an OMITTED intensity never escalates — the wire field is optional', () => {
    // The frontend's own 0.95 pose-strength default must not leak into this decision, or every
    // message the model sends without an explicit intensity performs the intense clip.
    for (const k of ExpressionKey.options) expect(affectToEmotion(k, undefined)).toBe(affectToEmotion(k, 0));
  });

  test('the threshold sits at 0.7, exclusive below and inclusive at', () => {
    expect(affectToEmotion('guarded_distance', 0.69)).toBe('skeptical');
    expect(affectToEmotion('guarded_distance', 0.7)).toBe('fakeFierce');
  });
});
