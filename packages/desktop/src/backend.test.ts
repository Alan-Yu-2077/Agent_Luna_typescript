import { describe, expect, test } from 'bun:test';
import { resolveSidecarDb, shouldAttach } from './backend';

const SHARED = '/repo/luna.sqlite';
const USER = '/userData/luna.sqlite';

describe('resolveSidecarDb (v0.28.8)', () => {
  test('uses the shared repo DB when it exists and not in smoke', () => {
    const db = resolveSidecarDb({ sharedDb: SHARED, userDb: USER, smoke: false, exists: () => true });
    expect(db).toBe(SHARED);
  });

  test('falls back to the app-data DB when the shared path is absent', () => {
    const db = resolveSidecarDb({ sharedDb: SHARED, userDb: USER, smoke: false, exists: () => false });
    expect(db).toBe(USER);
  });

  test('never touches the real DB under SMOKE, even when the shared path exists', () => {
    const db = resolveSidecarDb({ sharedDb: SHARED, userDb: USER, smoke: true, exists: () => true });
    expect(db).toBe(USER);
  });
});

describe('shouldAttach (v0.28.8)', () => {
  test('attaches when a backend is already listening', () => {
    expect(shouldAttach({ portListening: true, smoke: false })).toBe(true);
  });

  test('spawns its own when nothing is listening', () => {
    expect(shouldAttach({ portListening: false, smoke: false })).toBe(false);
  });

  test('SMOKE never attaches (deterministic + isolated), even if a port is up', () => {
    expect(shouldAttach({ portListening: true, smoke: true })).toBe(false);
  });
});
