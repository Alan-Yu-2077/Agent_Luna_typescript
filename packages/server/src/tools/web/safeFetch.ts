import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

// SSRF guard + safe fetcher (Initiative 11, v0.18.1) — the security keystone.
// The URL analogue of resolveInWorkspace (workspace.ts): canonicalize → resolve
// → validate the RESOLVED IP against a deny-list → re-validate on every redirect
// and at connect (DNS-rebinding). Always-on inside the tool (LD #10), pure +
// table-driven + exhaustively tested. This file is in the evaluator-firewall set
// (workspace.ts): a future propose_self_edit can never rewrite the guard.

const MAX_URL_LEN = 2048;
const MAX_REDIRECTS = 5;
const USER_AGENT = 'Luna/0.18 (+https://github.com/Alan-Yu-2077/Agent_Luna_typescript)';

export type AssertResult = { ok: true; url: URL } | { ok: false; reason: string };

// Injectable resolver (host → IP strings) so tests drive the deny-list + the
// rebinding check without real DNS. Default = node:dns lookup (all A/AAAA).
export type Resolver = (host: string) => Promise<string[]>;

async function defaultResolve(host: string): Promise<string[]> {
  const recs = await lookup(host, { all: true });
  return recs.map((r) => r.address);
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const o = Number(p);
    if (o > 255) return null;
    n = n * 256 + o;
  }
  return n >>> 0;
}

function inV4Range(n: number, base: string, bits: number): boolean {
  const b = ipv4ToInt(base);
  if (b === null) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (n & mask) === (b & mask);
}

// Blocks loopback / RFC1918 / CGNAT / link-local (incl. cloud metadata
// 169.254.169.254) / broadcast / multicast / reserved / TEST-NET. Fail-closed:
// an unparseable address is treated as blocked.
function isBlockedIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return true;
  return (
    inV4Range(n, '0.0.0.0', 8) || // "this host on this network"
    inV4Range(n, '10.0.0.0', 8) || // RFC1918
    inV4Range(n, '100.64.0.0', 10) || // CGNAT
    inV4Range(n, '127.0.0.0', 8) || // loopback
    inV4Range(n, '169.254.0.0', 16) || // link-local + 169.254.169.254 metadata
    inV4Range(n, '172.16.0.0', 12) || // RFC1918
    inV4Range(n, '192.0.0.0', 24) || // IETF protocol assignments
    inV4Range(n, '192.0.2.0', 24) || // TEST-NET-1
    inV4Range(n, '192.168.0.0', 16) || // RFC1918
    inV4Range(n, '198.18.0.0', 15) || // benchmarking
    inV4Range(n, '198.51.100.0', 24) || // TEST-NET-2
    inV4Range(n, '203.0.113.0', 24) || // TEST-NET-3
    inV4Range(n, '224.0.0.0', 4) || // multicast
    inV4Range(n, '240.0.0.0', 4) || // reserved
    n === 0xffffffff // broadcast
  );
}

function isBlockedIpv6(raw: string): boolean {
  const ip = raw.toLowerCase().replace(/^\[|\]$/g, '');
  if (ip === '::1' || ip === '::') return true; // loopback / unspecified
  // IPv4-mapped (::ffff:a.b.c.d) — validate the embedded v4
  const mappedDotted = ip.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mappedDotted) return isBlockedIpv4(mappedDotted[1]!);
  // IPv4-mapped in hex form (::ffff:7f00:1) — reconstruct + validate the v4
  const mappedHex = ip.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const hi = parseInt(mappedHex[1]!, 16);
    const lo = parseInt(mappedHex[2]!, 16);
    const v4 = `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
    return isBlockedIpv4(v4);
  }
  const head = parseInt(ip.split(':')[0] || '0', 16);
  if ((head & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((head & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
  if ((head & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  return false;
}

export function isBlockedIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return isBlockedIpv4(ip);
  if (kind === 6) return isBlockedIpv6(ip);
  return true; // not a valid IP literal → fail-closed
}

function hostOf(url: URL): string {
  return url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '');
}

// The keystone check. Canonicalizes the URL (the WHATWG URL parser already
// collapses decimal/hex/octal IPv4 forms to dotted-decimal) and validates either
// the IP literal directly or every resolved address of a hostname.
export async function assertPublicUrl(
  rawUrl: string,
  resolve: Resolver = defaultResolve,
): Promise<AssertResult> {
  if (rawUrl.length > MAX_URL_LEN) return { ok: false, reason: 'url exceeds 2048 chars' };
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'unparseable url' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: `scheme ${url.protocol} not allowed (http/https only)` };
  }
  if (url.username.length > 0 || url.password.length > 0) {
    return { ok: false, reason: 'embedded credentials (user:pass@) not allowed' };
  }
  const host = hostOf(url);
  if (host.length === 0) return { ok: false, reason: 'empty host' };

  if (isIP(host) !== 0) {
    if (isBlockedIp(host)) return { ok: false, reason: `blocked ip ${host}` };
    return { ok: true, url };
  }

  let ips: string[];
  try {
    ips = await resolve(host);
  } catch {
    return { ok: false, reason: `dns resolution failed for ${host}` };
  }
  if (ips.length === 0) return { ok: false, reason: `no dns records for ${host}` };
  for (const ip of ips) {
    if (isBlockedIp(ip)) return { ok: false, reason: `${host} resolves to blocked ip ${ip}` };
  }
  return { ok: true, url };
}

export type SafeFetchErrorCode =
  | 'blocked_url'
  | 'fetch_failed'
  | 'unsupported_type'
  | 'too_large'
  | 'too_many_redirects';

export class SafeFetchError extends Error {
  code: SafeFetchErrorCode;
  constructor(code: SafeFetchErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'SafeFetchError';
  }
}

export type SafeFetchResult = {
  status: number;
  contentType: string;
  body: string;
  finalUrl: string;
};

export type FetchImpl = (url: string, init: RequestInit) => Promise<Response>;

export type SafeFetchOptions = {
  maxBytes?: number;
  signal?: AbortSignal;
  resolve?: Resolver;
  fetchImpl?: FetchImpl;
};

async function readCapped(res: Response, maxBytes: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) {
    const text = await res.text();
    if (text.length > maxBytes)
      throw new SafeFetchError('too_large', `body exceeded ${maxBytes} bytes`);
    return text;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new SafeFetchError('too_large', `body exceeded ${maxBytes} bytes`);
      }
      chunks.push(value);
    }
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder().decode(merged);
}

// Fetch a URL safely: validate (+ rebinding re-check) before each hop, never
// auto-follow redirects (re-validate the Location), cap bytes, gate content-type.
export async function safeFetch(
  rawUrl: string,
  opts: SafeFetchOptions = {},
): Promise<SafeFetchResult> {
  const maxBytes = opts.maxBytes ?? Number(Bun.env['LUNA_WEB_FETCH_MAX_BYTES'] ?? 3_000_000);
  const resolve = opts.resolve ?? defaultResolve;
  const doFetch: FetchImpl = opts.fetchImpl ?? ((u, init) => fetch(u, init));

  let current = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const guard = await assertPublicUrl(current, resolve);
    if (!guard.ok) throw new SafeFetchError('blocked_url', guard.reason);

    // DNS-rebinding re-check: for a hostname (not an IP literal), re-resolve
    // immediately before connect and treat a now-private answer as an attack.
    const host = hostOf(guard.url);
    if (isIP(host) === 0) {
      let ips: string[];
      try {
        ips = await resolve(host);
      } catch {
        throw new SafeFetchError('blocked_url', `dns re-resolution failed for ${host}`);
      }
      for (const ip of ips) {
        if (isBlockedIp(ip)) throw new SafeFetchError('blocked_url', `dns rebind: ${host} → ${ip}`);
      }
    }

    let res: Response;
    try {
      res = await doFetch(current, {
        redirect: 'manual',
        signal: opts.signal,
        headers: { 'user-agent': USER_AGENT, accept: 'text/html, text/plain;q=0.9, */*;q=0.1' },
      });
    } catch (e) {
      if (opts.signal?.aborted) throw new SafeFetchError('fetch_failed', 'aborted');
      throw new SafeFetchError('fetch_failed', e instanceof Error ? e.message : String(e));
    }

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) throw new SafeFetchError('fetch_failed', `redirect ${res.status} with no location`);
      current = new URL(loc, current).toString();
      continue; // re-validated at the top of the next iteration
    }
    if (res.status < 200 || res.status >= 300) {
      throw new SafeFetchError('fetch_failed', `http ${res.status}`);
    }

    const ctype = (res.headers.get('content-type') ?? '').toLowerCase();
    if (!ctype.includes('text/html') && !ctype.includes('text/plain')) {
      throw new SafeFetchError(
        'unsupported_type',
        `content-type "${ctype || 'unknown'}" not supported`,
      );
    }

    const body = await readCapped(res, maxBytes);
    return { status: res.status, contentType: ctype, body, finalUrl: current };
  }
  throw new SafeFetchError('too_many_redirects', `exceeded ${MAX_REDIRECTS} redirects`);
}
