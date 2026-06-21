import { describe, expect, test } from 'bun:test';
import { lastGeoFix, requestGeolocation } from './geo';

describe('requestGeolocation', () => {
  test('no-ops when navigator.geolocation is unavailable (no throw, no callback, no fix)', () => {
    // bun's `navigator` has no `geolocation` → the secure-context guard returns early.
    let called = false;
    expect(() =>
      requestGeolocation(() => {
        called = true;
      }),
    ).not.toThrow();
    expect(called).toBe(false);
    expect(lastGeoFix()).toBeNull();
  });
});
