// v0.45.15 (Initiative 37, A2) — the CSWSH gate. The WS upgrade accepted every connection and
// handed it `sessionId: 'default'`, so ANY web page the owner happened to visit could open
// `ws://127.0.0.1:8787` and be treated as him: send chat, drive tools, and receive every
// ServerEvent (her replies, her memories, her diary). Loopback binding is no defense — a browser
// dials loopback happily; what identifies the caller is the Origin header, which page JavaScript
// cannot forge.
//
// The rule: a browser Origin must be loopback (any port — the owner's own web surfaces move
// between 5173 dev / 5177 packaged / 5178 smoke / whatever he runs). Non-browser clients send no
// Origin at all and stay welcome. Everything else is refused before the upgrade.

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]', '0.0.0.0']);

// Extra origins the owner explicitly trusts (comma-separated, exact match). Empty by default;
// exists so a legitimate future surface never needs the gate weakened to get in.
export function extraAllowedOrigins(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function isLoopbackOrigin(origin: string): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  return LOOPBACK_HOSTS.has(url.hostname);
}

// `origin` is the raw header value: absent (native/CLI clients) → null.
export function wsOriginAllowed(origin: string | null | undefined, extras: string[] = []): boolean {
  // No Origin at all: not a browser — a native client, a script, a test harness. The loopback
  // bind is the boundary for those, exactly as it always was.
  if (origin === undefined || origin === null || origin === '') return true;
  // A sandboxed/file:// page sends the literal "null" — it is not a same-machine web surface of
  // ours and it is not a native client either, so it does NOT get in.
  if (origin === 'null') return false;
  if (extras.includes(origin)) return true;
  return isLoopbackOrigin(origin);
}
