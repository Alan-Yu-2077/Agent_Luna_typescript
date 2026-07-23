// v0.28.0 (Initiative 20): first-run onboarding helpers. Pure + Electron-free so they unit-test
// without a window. The shell decides WHEN onboarding is needed, WHAT to write into luna.env
// (line-preserving, never a template clobber), and HOW to read a connection-probe outcome — the
// key never leaves the main process, and none of these functions return it.

// Matches sidecarEnv's placeholder (main.ts) — a key we injected to let the app boot, not a real one.
const PLACEHOLDER_KEY = 'sk-not-configured';

export function needsOnboarding(userEnv: Record<string, string>): boolean {
  const key = userEnv['ANTHROPIC_API_KEY'];
  return !key || key.trim() === '' || key === PLACEHOLDER_KEY;
}

// v0.35.4: the wizard is the default first-run experience; LUNA_SETUP_WIZARD=0 is the one-release
// escape hatch back to the v0.28 single card (delete plan: the release after Initiative 25 ships).
export function wizardFlagEnabled(value: string | undefined): boolean {
  return value !== '0';
}

// Line-preserving merge into an existing luna.env: replace the value of an already-present
// (uncommented) KEY= line in place, append a KEY=value for a missing one, and leave every other
// line — comments, blanks, unrelated keys — exactly as it was. A re-run must never clobber the
// weather/embedding/pet keys a power user already set by hand.
// Strip CR/LF (and other control chars) from a value before it becomes a KEY=value line — an
// embedded newline would otherwise write a SECOND line that parseEnvFile reads as an injected key
// (v0.28.3 review: a model/URL field pasted with a newline could smuggle in arbitrary env). A real
// key/URL/model id never contains a control char, so stripping is non-destructive.
function sanitizeValue(v: string): string {
  return v.replace(/[\x00-\x1f\x7f]/g, ''); // strip C0 control chars + DEL (a newline would inject a KEY= line)
}

export function mergeEnvFile(existing: string, fields: Record<string, string>): string {
  const lines = existing.split('\n');
  const remaining = new Map(Object.entries(fields).map(([k, v]) => [k, sanitizeValue(v)]));
  const out = lines.map((line) => {
    const eq = line.indexOf('=');
    if (eq <= 0 || line.trimStart().startsWith('#')) return line;
    const key = line.slice(0, eq).trim();
    if (remaining.has(key)) {
      const value = remaining.get(key)!;
      remaining.delete(key);
      return `${key}=${value}`;
    }
    return line;
  });
  // Append any field that had no existing line. Keep a single trailing newline.
  const appended = [...remaining].map(([k, v]) => `${k}=${v}`);
  if (appended.length > 0) {
    while (out.length > 0 && out[out.length - 1] === '') out.pop();
    out.push('', ...appended, '');
  }
  return out.join('\n');
}

// v0.35.0: the exact set of luna.env keys the setup wizard may write. mergeEnvFile writes whatever
// it is handed, so this whitelist is the defense-in-depth boundary between the renderer-collected
// field map and the config file — anything outside it is silently dropped, never persisted.
export const WIZARD_KEYS = [
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_API_KEY',
  'LUNA_MODEL',
  'LUNA_EMBEDDING_MODEL',
  'LUNA_EMBEDDING_API_KEY',
  'LUNA_EMBEDDING_BASE_URL',
  'LUNA_WEB_SEARCH_PROVIDER',
  'LUNA_WEB_SEARCH_API_KEY',
  'LUNA_WEATHER_PROVIDER',
  'LUNA_WEATHER_API_KEY',
  'LUNA_WEATHER_API_HOST',
  'LUNA_LAT_LON',
  'LUNA_UI_MODE', // v0.39.2: 'full' (Live2D + voice) | 'agent' (chat only) — the wizard's first step
  'LUNA_MODEL_URL',
  'LUNA_TTS_BACKEND',
  'LUNA_TTS_URL',
  'LUNA_TTS_REF_AUDIO',
  'LUNA_TTS_PROMPT_TEXT',
  'LUNA_TTS_PROMPT_LANG',
  'LUNA_TTS_TEXT_LANG',
  'LUNA_TTS_RUNTIME_DIR', // v0.35.3: the user's GPT-SoVITS checkout — wizard-managed, server never reads it
  'LUNA_TTS_MANAGED', // v0.37.0: Luna spawns + supervises api_v2 herself (the never-spawn escape hatch)
  'LUNA_TTS_PROVISION', // v0.37.2: the wizard's one-click GPT-SoVITS installer (preview flag)
  'LUNA_TTS_HF_MIRROR', // v0.37.2: HuggingFace host override for CN networks
] as const;

// v0.37.8: the keys whose VALUE must never leave the main process. The wizard is told only that
// they are SET (by name), so re-running setup can say "already configured" without the renderer
// ever holding a secret — and an untouched (empty) field is dropped at submit, so mergeEnvFile
// preserves what is stored.
export const SECRET_KEYS: readonly string[] = [
  'ANTHROPIC_API_KEY',
  'LUNA_EMBEDDING_API_KEY',
  'LUNA_WEB_SEARCH_API_KEY',
  'LUNA_WEATHER_API_KEY',
];

export function wizardPrefill(env: Record<string, string>): {
  values: Record<string, string>;
  configured: string[];
} {
  const values: Record<string, string> = {};
  const configured: string[] = [];
  for (const key of WIZARD_KEYS) {
    const v = (env[key] ?? '').trim();
    if (v === '') continue;
    if (SECRET_KEYS.includes(key)) configured.push(key);
    else values[key] = v;
  }
  return { values, configured };
}

export function filterWizardFields(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof raw !== 'object' || raw === null) return out;
  const rec = raw as Record<string, unknown>;
  for (const key of WIZARD_KEYS) {
    const v = rec[key];
    if (typeof v !== 'string') continue;
    const trimmed = v.trim();
    if (trimmed !== '') out[key] = trimmed;
  }
  return out;
}

export type ProbeVerdict = { ok: boolean; error?: string };

// Classify a connection-test outcome into a user-facing verdict. `status` is the HTTP status from
// a minimal request to {baseUrl}/v1/messages; null means fetch threw (DNS/connect failure). A 2xx
// OR a 400 both mean the request was authenticated and reached the model (a 400 is a request-shape
// detail like max_tokens), so the key + URL are good. 401/403 = key rejected; 404 = wrong endpoint.
export function classifyProbe(status: number | null): ProbeVerdict {
  if (status === null) return { ok: false, error: "Couldn't reach that URL — check the base URL." };
  if (status === 401 || status === 403) return { ok: false, error: 'The API key was rejected.' };
  if (status === 404)
    return { ok: false, error: 'Endpoint not found — check the base URL (e.g. https://api.anthropic.com).' };
  if (status < 400 || status === 400) return { ok: true };
  return { ok: false, error: `The server returned ${status}. Check your settings and try again.` };
}
