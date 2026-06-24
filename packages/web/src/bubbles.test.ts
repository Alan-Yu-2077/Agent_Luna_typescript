import { describe, expect, test } from 'bun:test';
import { messageSegments } from './bubbles';

describe('messageSegments (v0.21.10 — un-merge persisted multi-bubble turns)', () => {
  test('a single-message turn stays one bubble', () => {
    expect(messageSegments('Just one thing.')).toEqual(['Just one thing.']);
  });

  test('a newline-joined multi-message turn splits into one bubble per message', () => {
    expect(messageSegments('First bubble.\nSecond bubble.\nThird.')).toEqual([
      'First bubble.',
      'Second bubble.',
      'Third.',
    ]);
  });

  test('a verbatim-consecutive duplicate (the model stutter) is dropped', () => {
    expect(messageSegments('Still here.\nStill here.')).toEqual(['Still here.']);
    expect(messageSegments('A\nStill here.\nStill here.\nB')).toEqual(['A', 'Still here.', 'B']);
  });

  test('blank lines and surrounding whitespace are ignored', () => {
    expect(messageSegments('  A  \n\n  B  ')).toEqual(['A', 'B']);
  });

  test('all-whitespace degrades to the original (never returns empty)', () => {
    expect(messageSegments('   ')).toEqual(['   ']);
  });
});
