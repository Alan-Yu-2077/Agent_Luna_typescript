import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import { migrate } from '../sql';
import { initSettings, setSetting, settingsState } from './store';
import { SETTING_SPECS, specFor, validateValue } from './registry';

const TOUCHED = ['LUNA_PROACTIVE', 'LUNA_LAT_LON', 'LUNA_TZ', 'LUNA_SELFCONT_PROBABILITY'];
let saved: Array<[string, string | undefined]> = [];
let db: Database;

beforeEach(() => {
  saved = TOUCHED.map((k) => [k, Bun.env[k]]);
  for (const k of TOUCHED) delete Bun.env[k];
  db = new Database(':memory:', { strict: true });
  migrate(db, join(import.meta.dir, '..', 'migrations'));
  initSettings(db);
});

afterEach(() => {
  for (const [k, v] of saved) {
    if (v === undefined) delete Bun.env[k];
    else Bun.env[k] = v;
  }
  // Re-init against a throwaway db so pins from this test never leak into the next suite.
  const scratch = new Database(':memory:', { strict: true });
  migrate(scratch, join(import.meta.dir, '..', 'migrations'));
  initSettings(scratch);
});

function stateFor(key: string) {
  const s = settingsState().find((x) => x.key === key);
  if (!s) throw new Error(`no state for ${key}`);
  return s;
}

describe('settings registry', () => {
  test('whitelist has no secrets and unique keys/envs', () => {
    const keys = new Set<string>();
    const envs = new Set<string>();
    for (const s of SETTING_SPECS) {
      expect(keys.has(s.key)).toBe(false);
      expect(envs.has(s.env)).toBe(false);
      keys.add(s.key);
      envs.add(s.env);
      expect(s.env).not.toMatch(/KEY|TOKEN|SECRET/);
    }
  });

  test('validateValue: booleans, numbers with range, quiet hours, lat/lon', () => {
    const b = specFor('proactive.enabled');
    const n = specFor('selfcont.probability');
    const q = specFor('proactive.quiet_hours');
    const geo = specFor('weather.lat_lon');
    if (!b || !n || !q || !geo) throw new Error('specs missing');
    expect(validateValue(b, '1')).toBeNull();
    expect(validateValue(b, 'yes')).not.toBeNull();
    expect(validateValue(n, '0.5')).toBeNull();
    expect(validateValue(n, '1.5')).not.toBeNull();
    expect(validateValue(n, 'abc')).not.toBeNull();
    expect(validateValue(q, '0,1,23')).toBeNull();
    expect(validateValue(q, '24')).not.toBeNull();
    expect(validateValue(q, '')).toBeNull();
    expect(validateValue(geo, '31.23,121.47')).toBeNull();
    expect(validateValue(geo, '91,0')).not.toBeNull();
    expect(validateValue(geo, 'shanghai')).not.toBeNull();
  });

  test('skills.enabled is panel-visible (v0.32.0) — boot-read boolean over LUNA_SKILLS', () => {
    const s = specFor('skills.enabled');
    if (!s) throw new Error('skills.enabled spec missing');
    expect(s.env).toBe('LUNA_SKILLS');
    expect(s.kind).toBe('boolean');
    expect(s.defaultValue).toBe('1'); // mirrors skillsEnabled(): LUNA_SKILLS !== '0'
    expect(s.restartRequired).toBe(true); // registry composed at boot
    const d = specFor('skills.dream_distill');
    if (!d) throw new Error('skills.dream_distill spec missing');
    expect(d.env).toBe('LUNA_DREAM_SKILLS');
    expect(d.defaultValue).toBe('1'); // mirrors the v0.32.3 flip (=== '0' is the hatch)
    expect(d.restartRequired ?? false).toBe(false); // read call-time in the dream step
  });
});

describe('settings store', () => {
  test('default → env → user precedence with honest source', () => {
    expect(stateFor('proactive.enabled')).toMatchObject({ value: '1', source: 'default' });

    Bun.env['LUNA_PROACTIVE'] = '0';
    initSettings(db);
    expect(stateFor('proactive.enabled')).toMatchObject({ value: '0', source: 'env' });

    expect(setSetting('proactive.enabled', '1')).toEqual({ ok: true });
    expect(stateFor('proactive.enabled')).toMatchObject({ value: '1', source: 'user' });
    expect(Bun.env['LUNA_PROACTIVE']).toBe('1');
  });

  test('reset restores the ORIGINAL env value, not deletion', () => {
    Bun.env['LUNA_PROACTIVE'] = '0';
    initSettings(db);
    setSetting('proactive.enabled', '1');
    expect(setSetting('proactive.enabled', null)).toEqual({ ok: true });
    expect(Bun.env['LUNA_PROACTIVE']).toBe('0');
    expect(stateFor('proactive.enabled')).toMatchObject({ value: '0', source: 'env' });
  });

  test('reset deletes the env var when it was originally unset', () => {
    setSetting('weather.lat_lon', '31.23,121.47');
    expect(Bun.env['LUNA_LAT_LON']).toBe('31.23,121.47');
    setSetting('weather.lat_lon', null);
    expect(Bun.env['LUNA_LAT_LON']).toBeUndefined();
    expect(stateFor('weather.lat_lon').source).toBe('default');
  });

  test('pins survive a restart via the settings table', () => {
    setSetting('proactive.enabled', '0');
    delete Bun.env['LUNA_PROACTIVE'];
    initSettings(db); // simulated reboot: fresh snapshot, pins reloaded from SQLite
    expect(Bun.env['LUNA_PROACTIVE']).toBe('0');
    expect(stateFor('proactive.enabled')).toMatchObject({ value: '0', source: 'user' });
  });

  test('invalid value rejected, nothing mutates', () => {
    const r = setSetting('selfcont.probability', '2');
    expect(r.ok).toBe(false);
    expect(Bun.env['LUNA_SELFCONT_PROBABILITY']).toBeUndefined();
    expect(stateFor('selfcont.probability').source).toBe('default');
  });

  test('unknown key rejected', () => {
    expect(setSetting('nope.nope', '1').ok).toBe(false);
  });

  test('empty text pin means explicitly-unset (env var deleted)', () => {
    Bun.env['LUNA_TZ'] = 'Asia/Shanghai';
    initSettings(db);
    setSetting('time.zone', '');
    expect(Bun.env['LUNA_TZ']).toBeUndefined();
    expect(stateFor('time.zone')).toMatchObject({ value: '', source: 'user' });
  });

  test('env-file boolean spellings normalize display AND Bun.env', () => {
    Bun.env['LUNA_PROACTIVE'] = 'true'; // code reads !== '0' → ON
    initSettings(db);
    expect(stateFor('proactive.enabled').value).toBe('1');
    // regression (v0.27.1 review, low): Bun.env is canonicalized too, not just the display
    expect(Bun.env['LUNA_PROACTIVE']).toBe('1');
  });

  test('re-init after a pin does not corrupt the original env (reset still restores env-file value)', () => {
    // regression (v0.27.1 review, HIGH): a second init while a pin is still applied to Bun.env
    // must NOT re-snapshot our own overlay as the "original".
    Bun.env['LUNA_PROACTIVE'] = 'true'; // the user's env-file value
    initSettings(db); // snapshot original = '1' (canonical)
    setSetting('proactive.enabled', '0'); // pin → Bun.env now '0'
    initSettings(db); // second init WITHOUT clearing Bun.env — the bug scenario
    setSetting('proactive.enabled', null); // reset
    expect(Bun.env['LUNA_PROACTIVE']).toBe('1'); // the env-file value, NOT the lost pin
    expect(stateFor('proactive.enabled')).toMatchObject({ value: '1', source: 'env' });
  });

  test('re-init leaves a genuine user env change intact (only our pins are undone)', () => {
    initSettings(db); // LUNA_PROACTIVE unset → default
    Bun.env['LUNA_PROACTIVE'] = '0'; // user edits the actual environment (not via a pin)
    initSettings(db); // must pick this up as the new env, not undo it
    expect(stateFor('proactive.enabled')).toMatchObject({ value: '0', source: 'env' });
  });

  test('stale DB row for a removed spec is ignored, not deleted', () => {
    db.run(
      'INSERT INTO settings (key, value, updated_ms) VALUES (?, ?, ?)',
      ['ghost.setting', '1', 0],
    );
    initSettings(db);
    expect(settingsState().every((s) => s.key !== 'ghost.setting')).toBe(true);
    const kept = db.query('SELECT key FROM settings WHERE key = ?').all('ghost.setting');
    expect(kept.length).toBe(1);
  });

  test('no db → sets apply live but are not persisted', () => {
    initSettings(null);
    expect(setSetting('proactive.enabled', '0')).toEqual({ ok: true });
    expect(Bun.env['LUNA_PROACTIVE']).toBe('0');
    initSettings(null); // reboot without persistence: pin gone
    expect(stateFor('proactive.enabled').source).not.toBe('user');
  });
});
