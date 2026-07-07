import { describe, expect, test } from 'bun:test';
import {
  coreLocationFix,
  formatLatLon,
  parseLatLon,
  resolveDesktopLocation,
  timezoneFix,
} from './location';

const DENIED = 'CoreLocationCLI: ❌ Location services are disabled or location access denied.';

describe('parseLatLon', () => {
  test('parses "lat,lon" (with or without spaces)', () => {
    expect(parseLatLon('31.23,121.47')).toEqual({ lat: 31.23, lon: 121.47 });
    expect(parseLatLon('  31.23 , 121.47 \n')).toEqual({ lat: 31.23, lon: 121.47 });
    expect(parseLatLon('-33.87,151.21')).toEqual({ lat: -33.87, lon: 151.21 });
  });
  test('the CoreLocationCLI denied line → null', () => {
    expect(parseLatLon(DENIED)).toBeNull();
  });
  test('out-of-range or null-island → null', () => {
    expect(parseLatLon('200,0')).toBeNull();
    expect(parseLatLon('0,0')).toBeNull();
    expect(parseLatLon('')).toBeNull();
  });
});

describe('coreLocationFix', () => {
  test('non-darwin → null without execing', () => {
    let called = false;
    const fix = coreLocationFix({
      platform: 'linux',
      exec: () => {
        called = true;
        return '1,1';
      },
    });
    expect(fix).toBeNull();
    expect(called).toBe(false);
  });
  test('a coordinate line → the fix', () => {
    const fix = coreLocationFix({ platform: 'darwin', exec: () => '31.23,121.47', cliPaths: ['/x'] });
    expect(fix).toEqual({ lat: 31.23, lon: 121.47 });
  });
  test('a denied line → null', () => {
    expect(coreLocationFix({ platform: 'darwin', exec: () => DENIED, cliPaths: ['/x'] })).toBeNull();
  });
  test('exec throwing (ENOENT / non-zero / timeout) → null, tries next path', () => {
    const seen: string[] = [];
    const fix = coreLocationFix({
      platform: 'darwin',
      cliPaths: ['/a', '/b'],
      exec: (file) => {
        seen.push(file);
        if (file === '/a') throw new Error('ENOENT');
        return '10,20';
      },
    });
    expect(fix).toEqual({ lat: 10, lon: 20 });
    expect(seen).toEqual(['/a', '/b']);
  });
});

describe('timezoneFix', () => {
  test('a known zone → its city', () => {
    expect(timezoneFix('Asia/Shanghai')).toEqual({ lat: 31.23, lon: 121.47 });
    expect(timezoneFix('America/New_York')).toEqual({ lat: 40.71, lon: -74.01 });
  });
  test('unknown zone / undefined → null', () => {
    expect(timezoneFix('Antarctica/South_Pole')).toBeNull();
    expect(timezoneFix(undefined)).toBeNull();
  });
});

describe('resolveDesktopLocation (the chain)', () => {
  test('a valid manual value is respected — never overridden', () => {
    const fix = resolveDesktopLocation(
      { LUNA_LAT_LON: '1.0,2.0' },
      { platform: 'darwin', tz: 'Asia/Shanghai', exec: () => '31.23,121.47' },
    );
    expect(fix).toBeNull();
  });
  test('an empty/invalid manual value does NOT block acquisition', () => {
    const fix = resolveDesktopLocation(
      { LUNA_LAT_LON: '' },
      { platform: 'darwin', tz: 'Asia/Shanghai', exec: () => '31.23,121.47' },
    );
    expect(fix).toEqual({ lat: 31.23, lon: 121.47, source: 'corelocation', persist: true });
  });
  test('CoreLocation wins over timezone and persists', () => {
    const fix = resolveDesktopLocation(
      {},
      { platform: 'darwin', tz: 'Asia/Tokyo', exec: () => '35.0,139.0' },
    );
    expect(fix).toEqual({ lat: 35, lon: 139, source: 'corelocation', persist: true });
  });
  test('CoreLocation denied → timezone fallback (coarse, not persisted)', () => {
    const fix = resolveDesktopLocation(
      {},
      { platform: 'darwin', tz: 'Asia/Shanghai', exec: () => DENIED },
    );
    expect(fix).toEqual({ lat: 31.23, lon: 121.47, source: 'timezone', persist: false });
  });
  test('nothing available (no fix, unknown tz) → null', () => {
    const fix = resolveDesktopLocation(
      {},
      { platform: 'darwin', tz: 'Antarctica/South_Pole', exec: () => DENIED },
    );
    expect(fix).toBeNull();
  });
});

describe('formatLatLon', () => {
  test('serializes to LUNA_LAT_LON form', () => {
    expect(formatLatLon({ lat: 31.23, lon: 121.47 })).toBe('31.23,121.47');
  });
});
