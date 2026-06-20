import { afterEach, describe, expect, test } from 'bun:test';
import { markRead, resetReadTracking, wasRead } from './readTracking';

afterEach(() => resetReadTracking());

describe('readTracking (v0.20.9 coverage)', () => {
  test('markRead then wasRead by canonical path', () => {
    markRead('s1', '/abs/foo.ts');
    expect(wasRead('s1', '/abs/foo.ts')).toBe(true);
    expect(wasRead('s1', '/abs/bar.ts')).toBe(false);
  });

  test('session-isolated: another session has not read it', () => {
    markRead('s1', '/abs/foo.ts');
    expect(wasRead('s2', '/abs/foo.ts')).toBe(false);
  });

  test('reset(one session) clears only that session', () => {
    markRead('s1', '/a');
    markRead('s2', '/b');
    resetReadTracking('s1');
    expect(wasRead('s1', '/a')).toBe(false);
    expect(wasRead('s2', '/b')).toBe(true);
  });

  test('reset(all) clears everything', () => {
    markRead('s1', '/a');
    markRead('s2', '/b');
    resetReadTracking();
    expect(wasRead('s1', '/a')).toBe(false);
    expect(wasRead('s2', '/b')).toBe(false);
  });
});
