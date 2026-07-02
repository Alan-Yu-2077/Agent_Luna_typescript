import { describe, expect, test } from 'bun:test';
import { resolveWsUrl } from './wsUrl';

describe('resolveWsUrl (v0.26.0)', () => {
  test('default → fixed 127.0.0.1:8787 regardless of how the page is served', () => {
    expect(resolveWsUrl('')).toBe('ws://127.0.0.1:8787');
    expect(resolveWsUrl('?dev')).toBe('ws://127.0.0.1:8787');
  });

  test('?ws= override keeps the isolated-dev flow working', () => {
    expect(resolveWsUrl('?ws=8888')).toBe('ws://127.0.0.1:8888');
    expect(resolveWsUrl('?dev&ws=8899')).toBe('ws://127.0.0.1:8899');
  });

  test('a custom default port threads through (the desktop shell picks the spawned port)', () => {
    expect(resolveWsUrl('', '9010')).toBe('ws://127.0.0.1:9010');
  });
});
