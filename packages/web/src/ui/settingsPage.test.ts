import { describe, expect, test } from 'bun:test';
import { iaKeys, SETTINGS_CATEGORIES, SETTINGS_IA } from './settingsPage';
import { IDLE_PROFILE_KEY, PERF_FLAGS } from '../live2d/perfFlags';
import { COSTUME_KEY } from '../live2d/costume';

// v0.44.5 — the reconciliation. The version's one real risk is losing a switch in the move, so the
// IA declaration is audited here key by key against the modules that OWN the keys. The DOM half is
// an adoption of the very same elements (same listeners, same semantics), so what these tests pin
// is the map; the packaged smoke and the live check pin the furniture.

describe('the settings IA — every control accounted for, none twice (v0.44.5)', () => {
  // v0.44.6 grew the five to seven: Persona (about HER, not widgets) and Modules (four cards would
  // have buried System) each earned their own rail entry.
  test('seven categories, in the approved order', () => {
    expect(SETTINGS_CATEGORIES.map((c) => c.id)).toEqual([
      'voice',
      'expression',
      'appearance',
      'behaviour',
      'persona',
      'modules',
      'system',
    ]);
  });

  test('no key appears in two categories', () => {
    const keys = iaKeys();
    expect(new Set(keys).size).toBe(keys.length);
  });

  // The old panel's full localStorage inventory, written OUT here as the migration checklist. If a
  // future version adds a key to the panel without placing it in the IA, this list is where the
  // reviewer sees the omission.
  test('the inventory matches the old panel exactly', () => {
    expect([...iaKeys()].sort()).toEqual(
      [
        'luna:tts',
        'luna:live2d',
        'luna:gaze-follow',
        'luna:affect',
        'luna:live-peak',
        'luna:short-clips',
        'luna:idle-actions',
        'luna:listening',
        'luna:speech-performance',
        'luna:idle-profile',
        'luna:costume',
      ].sort(),
    );
  });

  // Cross-check against the modules that own the keys — the IA cannot drift from the engine's own
  // flag list without going red.
  test('every per-tick performance flag has exactly one home', () => {
    for (const flag of PERF_FLAGS) {
      const homes = Object.values(SETTINGS_IA).filter((keys) => keys.includes(flag.key));
      expect(`${flag.key}:${homes.length}`).toBe(`${flag.key}:1`);
    }
  });

  test('the idle profile selector and the costume store are placed', () => {
    expect(SETTINGS_IA.expression).toContain(IDLE_PROFILE_KEY);
    expect(SETTINGS_IA.appearance).toContain(COSTUME_KEY);
  });

  test('gaze-follow lives under Appearance — it is about her eyes in the room, not a performance', () => {
    expect(SETTINGS_IA.appearance).toContain('luna:gaze-follow');
    expect(SETTINGS_IA.expression).not.toContain('luna:gaze-follow');
  });
});
