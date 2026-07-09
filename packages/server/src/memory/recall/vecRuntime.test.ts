import { describe, expect, test } from 'bun:test';
import { resolveSqliteLib } from './vecRuntime';

describe('resolveSqliteLib', () => {
  test('LUNA_SQLITE_LIB override wins when it exists', () => {
    const got = resolveSqliteLib({
      override: '/custom/libsqlite3.dylib',
      exists: (p) => p === '/custom/libsqlite3.dylib',
    });
    expect(got).toBe('/custom/libsqlite3.dylib');
  });

  test('override is preferred over a matching built-in candidate', () => {
    const got = resolveSqliteLib({
      override: '/custom/libsqlite3.dylib',
      // both the override and a built-in exist — override must come first
      exists: (p) => p === '/custom/libsqlite3.dylib' || p.includes('homebrew'),
    });
    expect(got).toBe('/custom/libsqlite3.dylib');
  });

  test('falls back to the first existing built-in candidate', () => {
    const got = resolveSqliteLib({
      exists: (p) => p === '/usr/lib/x86_64-linux-gnu/libsqlite3.so',
    });
    expect(got).toBe('/usr/lib/x86_64-linux-gnu/libsqlite3.so');
  });

  test('returns null when nothing exists', () => {
    expect(resolveSqliteLib({ override: undefined, exists: () => false })).toBeNull();
  });

  test('explicit candidates list is honored in order', () => {
    const got = resolveSqliteLib({
      override: undefined,
      candidates: ['/a', '/b', '/c'],
      exists: (p) => p === '/b' || p === '/c',
    });
    expect(got).toBe('/b');
  });
});
