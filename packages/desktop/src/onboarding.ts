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
