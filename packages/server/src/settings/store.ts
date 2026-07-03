import type { Database } from 'bun:sqlite';
import type { Setting } from '@luna/protocol';
import { SETTING_SPECS, specFor, validateValue, type SettingSpec } from './registry';

// v0.27.1: the settings store. Three layers, strictly ordered: a user pin (set from the panel,
// held in `pins` + the settings table) > the ORIGINAL process env (snapshotted at init, before
// any overlay — .env / luna.env territory) > the registry default. Pins are applied by mutating
// Bun.env, which works because nearly every whitelisted flag is read call-time; the boot-time
// ones are marked restartRequired and still land next boot via initSettings() running before
// provider/registry construction. Reset (value=null) restores the snapshot, so env-file users
// get their file value back, not ours.

let db: Database | null = null;
let initialized = false;
const pins = new Map<string, string>();
const originalEnv = new Map<string, string | undefined>();

function applyPin(spec: SettingSpec, value: string): void {
  // An empty text pin means "explicitly unset" — deleting beats writing '' because readers
  // guard with truthiness OR ?? inconsistently, and '' would leak through the ?? ones.
  if (spec.kind === 'text' && value === '') delete Bun.env[spec.env];
  else Bun.env[spec.env] = value;
}

// Normalize an env-file boolean: the codebase tests `!== '0'` (default-ON) or `=== '1'`
// (default-OFF), so e.g. LUNA_PROACTIVE=true means ON but must canonicalize to '1'. Used for
// BOTH the display value AND the stored Bun.env, so the two never desync.
function displayBoolean(spec: SettingSpec, raw: string): string {
  if (spec.defaultValue === '1') return raw === '0' ? '0' : '1';
  return raw === '1' ? '1' : '0';
}

export function initSettings(database: Database | null): void {
  // Undo any pins a PREVIOUS init applied to Bun.env before we re-snapshot — otherwise a second
  // init within one process would capture our own overlay as the "original", and a later reset
  // would restore the pin instead of the user's env-file value. We only touch envs WE pinned, so
  // a genuine env change the user made between inits is left intact.
  for (const key of pins.keys()) {
    const spec = specFor(key);
    if (!spec) continue;
    const orig = originalEnv.get(spec.env);
    if (orig === undefined) delete Bun.env[spec.env];
    else Bun.env[spec.env] = orig;
  }
  db = database;
  initialized = true;
  pins.clear();
  originalEnv.clear();
  for (const s of SETTING_SPECS) {
    let v = Bun.env[s.env];
    // Canonicalize boolean spellings in Bun.env itself ('true'→'1'), so the stored env, the
    // displayed value, and a later reset all agree. Readers accept both forms; a mix would let
    // the panel show '1' while Bun.env held 'true'.
    if (v !== undefined && s.kind === 'boolean') {
      v = displayBoolean(s, v);
      Bun.env[s.env] = v;
    }
    originalEnv.set(s.env, v);
  }
  if (!db) return;
  const rows = db
    .query('SELECT key, value FROM settings')
    .all() as Array<{ key: string; value: string }>;
  for (const row of rows) {
    const spec = specFor(row.key);
    // Rows for removed specs or values a newer validator rejects are ignored, not deleted —
    // a rollback to the older server picks them right back up.
    if (!spec || validateValue(spec, row.value) !== null) continue;
    pins.set(row.key, row.value);
    applyPin(spec, row.value);
  }
}

export function settingsState(): Setting[] {
  return SETTING_SPECS.map((s) => {
    const pinned = pins.get(s.key);
    // orig is already boolean-canonical (initSettings normalized Bun.env + the snapshot).
    const orig = originalEnv.get(s.env);
    const value = pinned ?? orig ?? s.defaultValue;
    const setting: Setting = {
      key: s.key,
      label: s.label,
      hint: s.hint,
      category: s.category,
      kind: s.kind,
      value,
      source: pinned !== undefined ? 'user' : orig !== undefined ? 'env' : 'default',
      restart_required: s.restartRequired ?? false,
    };
    if (s.min !== undefined) setting.min = s.min;
    if (s.max !== undefined) setting.max = s.max;
    return setting;
  });
}

export type SetResult = { ok: true } | { ok: false; error: string };

export function setSetting(key: string, value: string | null): SetResult {
  if (!initialized) return { ok: false, error: 'settings not initialized' };
  const spec = specFor(key);
  if (!spec) return { ok: false, error: `unknown setting: ${key}` };
  if (value === null) {
    pins.delete(key);
    db?.run('DELETE FROM settings WHERE key = ?', [key]);
    const orig = originalEnv.get(spec.env);
    if (orig === undefined) delete Bun.env[spec.env];
    else Bun.env[spec.env] = orig;
    return { ok: true };
  }
  const err = validateValue(spec, value);
  if (err !== null) return { ok: false, error: err };
  pins.set(key, value);
  db?.run(
    'INSERT INTO settings (key, value, updated_ms) VALUES (?, ?, ?) ' +
      'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_ms = excluded.updated_ms',
    [key, value, Date.now()],
  );
  applyPin(spec, value);
  return { ok: true };
}
