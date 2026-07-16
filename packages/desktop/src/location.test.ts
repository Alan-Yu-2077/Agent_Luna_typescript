import { describe, expect, test } from 'bun:test';
import {
  coreLocationFix,
  coreLocationFixAsync,
  formatLatLon,
  movedBeyond,
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

  // v0.37.17 — the un-freeze. Our own persisted cache (LUNA_LAT_LON_AUTO) must never read as a
  // manual pin: fresh acquisition always runs, the cache only backstops its failure.
  test('a persisted AUTO cache never blocks acquisition — fresh CoreLocation wins', () => {
    const fix = resolveDesktopLocation(
      { LUNA_LAT_LON_AUTO: '34.373533,108.906581' },
      { platform: 'darwin', tz: 'Asia/Shanghai', exec: () => '30.25,120.17' },
    );
    expect(fix).toEqual({ lat: 30.25, lon: 120.17, source: 'corelocation', persist: true });
  });
  test('CoreLocation denied → the AUTO cache (last accurate fix) beats the timezone city', () => {
    const fix = resolveDesktopLocation(
      { LUNA_LAT_LON_AUTO: '34.373533,108.906581' },
      { platform: 'darwin', tz: 'Asia/Shanghai', exec: () => DENIED },
    );
    expect(fix).toEqual({ lat: 34.373533, lon: 108.906581, source: 'cached', persist: false });
  });
  test('an invalid AUTO cache falls through to the timezone city', () => {
    const fix = resolveDesktopLocation(
      { LUNA_LAT_LON_AUTO: 'garbage' },
      { platform: 'darwin', tz: 'Asia/Shanghai', exec: () => DENIED },
    );
    expect(fix).toEqual({ lat: 31.23, lon: 121.47, source: 'timezone', persist: false });
  });
  test('a manual pin still silences the whole chain, AUTO cache or not', () => {
    const fix = resolveDesktopLocation(
      { LUNA_LAT_LON: '1.0,2.0', LUNA_LAT_LON_AUTO: '34.37,108.91' },
      { platform: 'darwin', tz: 'Asia/Shanghai', exec: () => '30.25,120.17' },
    );
    expect(fix).toBeNull();
  });
});

describe('movedBeyond', () => {
  test('no prior fix → always a move', () => {
    expect(movedBeyond(null, { lat: 31.23, lon: 121.47 })).toBe(true);
  });
  test('Wi-Fi jitter (<~55 m) is not a move', () => {
    expect(movedBeyond({ lat: 31.23, lon: 121.47 }, { lat: 31.2303, lon: 121.4703 })).toBe(false);
  });
  test('a real move (a few blocks) registers', () => {
    expect(movedBeyond({ lat: 31.23, lon: 121.47 }, { lat: 31.24, lon: 121.47 })).toBe(true);
    expect(movedBeyond({ lat: 31.23, lon: 121.47 }, { lat: 31.23, lon: 121.48 })).toBe(true);
  });
});

describe('coreLocationFixAsync', () => {
  test('non-darwin → null without execing', async () => {
    let called = false;
    const fix = await coreLocationFixAsync({
      platform: 'linux',
      execAsync: () => {
        called = true;
        return Promise.resolve('1,1');
      },
    });
    expect(fix).toBeNull();
    expect(called).toBe(false);
  });
  test('a coordinate line → the fix', async () => {
    const fix = await coreLocationFixAsync({
      platform: 'darwin',
      cliPaths: ['/x'],
      execAsync: () => Promise.resolve('31.23,121.47'),
    });
    expect(fix).toEqual({ lat: 31.23, lon: 121.47 });
  });
  test('a rejecting path (ENOENT / denied / timeout) → tries the next one', async () => {
    const seen: string[] = [];
    const fix = await coreLocationFixAsync({
      platform: 'darwin',
      cliPaths: ['/a', '/b'],
      execAsync: (file) => {
        seen.push(file);
        return file === '/a' ? Promise.reject(new Error('ENOENT')) : Promise.resolve('10,20');
      },
    });
    expect(fix).toEqual({ lat: 10, lon: 20 });
    expect(seen).toEqual(['/a', '/b']);
  });
  test('all paths fail → null', async () => {
    const fix = await coreLocationFixAsync({
      platform: 'darwin',
      cliPaths: ['/a'],
      execAsync: () => Promise.reject(new Error('denied')),
    });
    expect(fix).toBeNull();
  });
});

describe('formatLatLon', () => {
  test('serializes to LUNA_LAT_LON form', () => {
    expect(formatLatLon({ lat: 31.23, lon: 121.47 })).toBe('31.23,121.47');
  });
});
