import type { SettingKind } from '@luna/protocol';

// v0.27.1: the operator-settings whitelist. Every entry is an env-backed switch the settings
// panel may read AND write; anything not listed here is unreachable from the wire — secrets
// (API keys, base URLs) stay file-only by construction, not by filtering.
//
// defaultValue is DISPLAY-ONLY (shown when neither a user pin nor an env value exists) and must
// mirror the real default at the read site — the store never writes it into Bun.env. Booleans are
// normalized to '1'/'0' on this surface: every boolean flag in the codebase tests either
// `!== '0'` (default-ON) or `=== '1'` (default-OFF), so both forms round-trip correctly.
// restartRequired marks flags read at boot (provider/tool-registry construction) — a live set
// still persists + lands in Bun.env, but only takes effect next boot.

export type SettingSpec = {
  key: string;
  env: string;
  label: string;
  hint: string;
  category: string;
  kind: SettingKind;
  defaultValue: string;
  restartRequired?: boolean;
  min?: number;
  max?: number;
  validate?: (value: string) => string | null;
};

function validQuietHours(value: string): string | null {
  if (value.trim() === '') return null;
  const parts = value.split(',').map((s) => s.trim());
  for (const p of parts) {
    if (!/^\d{1,2}$/.test(p) || Number(p) > 23) {
      return 'quiet hours must be comma-separated hours 0-23 (e.g. "0,1,2,3,4,5")';
    }
  }
  return null;
}

function validActiveness(value: string): string | null {
  if (value.trim() === '') return null;
  return ['aloof', 'balanced', 'clingy'].includes(value.trim())
    ? null
    : 'activeness must be one of: aloof, balanced, clingy';
}

function validLatLon(value: string): string | null {
  if (value.trim() === '') return null;
  const m = value.split(',').map((s) => Number(s.trim()));
  if (m.length !== 2 || m.some((n) => !Number.isFinite(n))) {
    return 'location must be "lat,lon" (e.g. "40.71,-74.01")';
  }
  const [lat, lon] = m as [number, number];
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return 'lat must be -90..90, lon -180..180';
  return null;
}

export const SETTING_SPECS: readonly SettingSpec[] = [
  // -- Companion --------------------------------------------------------------------------
  {
    key: 'proactive.enabled',
    env: 'LUNA_PROACTIVE',
    label: 'Proactive messages',
    hint: 'She may reach out on her own when you go quiet',
    category: 'Companion',
    kind: 'boolean',
    defaultValue: '1',
  },
  {
    key: 'proactive.quiet_hours',
    env: 'LUNA_PROACTIVE_QUIET_HOURS',
    label: 'Quiet hours',
    hint: 'Local hours she stays silent, comma-separated',
    category: 'Companion',
    kind: 'text',
    defaultValue: '0,1,2,3,4,5',
    validate: validQuietHours,
  },
  {
    key: 'proactive.activeness',
    env: 'LUNA_PROACTIVE_ACTIVENESS',
    label: 'Outreach intensity',
    hint: 'How eagerly she opens first: aloof, balanced, or clingy (still capped by the safety rails)',
    category: 'Companion',
    kind: 'text',
    defaultValue: 'balanced',
    validate: validActiveness,
  },
  {
    key: 'selfcont.enabled',
    env: 'LUNA_SELFCONT',
    label: 'Follow-up thoughts',
    hint: 'She may add a second thought shortly after replying',
    category: 'Companion',
    kind: 'boolean',
    defaultValue: '1',
  },
  {
    key: 'selfcont.probability',
    env: 'LUNA_SELFCONT_PROBABILITY',
    label: 'Follow-up chance',
    hint: '0 = never, 1 = always',
    category: 'Companion',
    kind: 'number',
    defaultValue: '0.35',
    min: 0,
    max: 1,
  },
  // -- Perception -------------------------------------------------------------------------
  {
    key: 'time.aware',
    env: 'LUNA_TIME_AWARE',
    label: 'Time awareness',
    hint: 'She knows the clock, the date, and how long you were away',
    category: 'Perception',
    kind: 'boolean',
    defaultValue: '1',
  },
  {
    key: 'weather.ambient',
    env: 'LUNA_WEATHER_AMBIENT',
    label: 'Weather awareness',
    hint: 'Real weather colors her mood and small talk',
    category: 'Perception',
    kind: 'boolean',
    defaultValue: '1',
  },
  {
    key: 'weather.lat_lon',
    env: 'LUNA_LAT_LON',
    label: 'Location (lat,lon)',
    hint: 'Where she checks the weather, e.g. "40.71,-74.01"',
    category: 'Perception',
    kind: 'text',
    defaultValue: '',
    validate: validLatLon,
  },
  {
    key: 'time.zone',
    env: 'LUNA_TZ',
    label: 'Timezone',
    hint: 'IANA zone like America/New_York; empty = system',
    category: 'Perception',
    kind: 'text',
    defaultValue: '',
  },
  // -- Abilities (tool registry is built at boot) ------------------------------------------
  {
    key: 'web.search',
    env: 'LUNA_WEB_SEARCH',
    label: 'Web search',
    hint: 'She can search the web (needs a search API key)',
    category: 'Abilities',
    kind: 'boolean',
    defaultValue: '1',
    restartRequired: true,
  },
  {
    key: 'web.fetch',
    env: 'LUNA_WEB_FETCH',
    label: 'Read web pages',
    hint: 'She can open and read URLs',
    category: 'Abilities',
    kind: 'boolean',
    defaultValue: '1',
    restartRequired: true,
  },
  {
    key: 'skills.enabled',
    env: 'LUNA_SKILLS',
    label: 'Skill library',
    hint: 'She keeps + reuses saved procedures (save_skill / recall_skill + the skill shelf)',
    category: 'Abilities',
    kind: 'boolean',
    defaultValue: '1',
    restartRequired: true,
  },
  {
    key: 'skills.dream_distill',
    env: 'LUNA_DREAM_SKILLS',
    label: 'Dream skill distillation',
    hint: 'Her dream turns the day’s significant moments into reusable skills (audited, undoable)',
    category: 'Memory',
    kind: 'boolean',
    defaultValue: '1',
  },
  {
    key: 'weather.tool',
    env: 'LUNA_WEATHER',
    label: 'Weather lookups',
    hint: 'She can check the forecast on demand',
    category: 'Abilities',
    kind: 'boolean',
    defaultValue: '1',
    restartRequired: true,
  },
  {
    key: 'code.write',
    env: 'LUNA_CODE_WRITE',
    label: 'Code editing',
    hint: 'She can edit files in her workspace',
    category: 'Abilities',
    kind: 'boolean',
    defaultValue: '1',
    restartRequired: true,
  },
  {
    key: 'shell.enabled',
    env: 'LUNA_SHELL',
    label: 'Shell commands',
    hint: 'She can run commands in her workspace',
    category: 'Abilities',
    kind: 'boolean',
    defaultValue: '1',
    restartRequired: true,
  },
  // -- Memory -----------------------------------------------------------------------------
  {
    key: 'memory.inject',
    env: 'LUNA_MEMORY_INJECT',
    label: 'Memory in context',
    hint: 'Core memory and recalled moments shape her replies',
    category: 'Memory',
    kind: 'boolean',
    defaultValue: '1',
  },
  {
    key: 'dream.shutdown',
    env: 'LUNA_SHUTDOWN_DREAM',
    label: 'Dream on quit',
    hint: 'She consolidates memories before shutting down (at most once every few hours, not every close)',
    category: 'Memory',
    kind: 'boolean',
    defaultValue: '1',
  },
  // -- Model ------------------------------------------------------------------------------
  {
    key: 'model.id',
    env: 'LUNA_MODEL',
    label: 'Model',
    hint: 'The LLM she thinks with; empty = built-in default',
    category: 'Model',
    kind: 'text',
    defaultValue: '',
    restartRequired: true,
  },
];

export function specFor(key: string): SettingSpec | undefined {
  return SETTING_SPECS.find((s) => s.key === key);
}

// Returns an error message, or null when the value is acceptable for the spec.
export function validateValue(spec: SettingSpec, value: string): string | null {
  if (spec.kind === 'boolean') {
    return value === '0' || value === '1' ? null : `${spec.label} must be '1' or '0'`;
  }
  if (spec.kind === 'number') {
    const n = Number(value);
    if (value.trim() === '' || !Number.isFinite(n)) return `${spec.label} must be a number`;
    if (spec.min !== undefined && n < spec.min) return `${spec.label} must be ≥ ${spec.min}`;
    if (spec.max !== undefined && n > spec.max) return `${spec.label} must be ≤ ${spec.max}`;
    return null;
  }
  return spec.validate ? spec.validate(value) : null;
}
