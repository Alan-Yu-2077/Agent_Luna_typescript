import { lookup } from 'node:dns/promises';
import { isIP, type LookupFunction } from 'node:net';
import http from 'node:http';
import https from 'node:https';

// SSRF guard + safe fetcher (Initiative 11; pinned in v0.18.3) — the security
// keystone. The URL analogue of resolveInWorkspace (workspace.ts): canonicalize →
// resolve → validate the RESOLVED IP against a deny-list → re-validate on every
// redirect → and CONNECT TO THAT VALIDATED IP.
//
// The connection is PINNED: a node:http(s) custom `lookup` returns only the IP the
// deny-list validated, so the socket cannot be re-resolved to a different (private)
// address between the check and the connect — the DNS-rebinding TOCTOU is CLOSED,
// not merely narrowed. TLS SNI + certificate validation still key off the URL
// hostname, so HTTPS stays correct (we connect to the validated IP, verify the cert
// against the name). Verified end-to-end (real HTTPS smoke + injected-transport unit
// tests).
//
// Always-on inside the tool (LD #10), pure + table-driven + tested. In the
// evaluator-firewall set (workspace.ts): a future propose_self_edit can never
// rewrite the guard.

const MAX_URL_LEN = 2048;
const MAX_REDIRECTS = 5;
const USER_AGENT = 'Luna/0.18 (+https://github.com/Alan-Yu-2077/Agent_Luna_typescript)';

export type AssertResult =
  | { ok: true; url: URL; ips: string[] }
  | { ok: false; reason: string };

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
    // 198.18.0.0/15 (RFC 2544 benchmarking) is deliberately NOT blocked: it is not
    // internal infrastructure (no real SSRF target lives there) and is the default
    // fake-IP pool for Clash/Surge-style proxies — blocking it breaks web_fetch on
    // every proxied host, where EVERY domain resolves into 198.18.x. Internal access
    // stays closed by the IP-literal + RFC1918/loopback/link-local/metadata checks.
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
  // NAT64 (64:ff9b::/96) wraps an internal v4 in the low 32 bits — validate it as
  // v4 (else 64:ff9b::a9fe:a9fe would reach 169.254.169.254 on a NAT64 host).
  const nat64 = ip.match(
    /^64:ff9b::(?:([0-9a-f]{1,4}):([0-9a-f]{1,4})|(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}))$/,
  );
  if (nat64) {
    if (nat64[3]) return isBlockedIpv4(nat64[3]);
    const hi = parseInt(nat64[1]!, 16);
    const lo = parseInt(nat64[2]!, 16);
    return isBlockedIpv4(`${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`);
  }
  // 6to4 (2002::/16) wraps the v4 in the first two embedded hextets (2002:AABB:CCDD::).
  const sixToFour = ip.match(/^2002:([0-9a-f]{1,4}):([0-9a-f]{1,4})(?::|$)/);
  if (sixToFour) {
    const hi = parseInt(sixToFour[1]!, 16);
    const lo = parseInt(sixToFour[2]!, 16);
    return isBlockedIpv4(`${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`);
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
    return { ok: true, url, ips: [host] };
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
  return { ok: true, url, ips };
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

export type FetchInit = { signal?: AbortSignal; headers: Record<string, string>; redirect?: 'manual' };
// The transport. `pinIp` is the deny-list-validated address the socket must connect
// to (SNI/cert still keyed to the URL hostname). Injectable so unit tests drive the
// redirect/cap/content-type logic — and assert the pin — without real sockets.
export type FetchImpl = (url: string, init: FetchInit, pinIp: string) => Promise<Response>;

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

// The pinned transport (v0.18.3): connect to `pinIp` — the address the deny-list
// already validated — via a node:http(s) custom `lookup`, so the socket cannot be
// re-resolved to a private IP. TLS SNI + cert validation still use the URL hostname
// (we connect to the validated IP, verify the cert against the name). Returns a
// Response so safeFetch's redirect/cap/content-type logic stays transport-agnostic.
function pinnedFetch(rawUrl: string, init: FetchInit, pinIp: string): Promise<Response> {
  const u = new URL(rawUrl);
  const mod = u.protocol === 'https:' ? https : http;
  const fam = isIP(pinIp) === 6 ? 6 : 4;
  // Pin DNS to the validated IP. node may call lookup with all:true (array form,
  // which Bun uses) or all:false (single) — handle both.
  const pinnedLookup = (_host: string, options: { all?: boolean } | undefined, cb: (...a: unknown[]) => void): void => {
    if (options && options.all) cb(null, [{ address: pinIp, family: fam }]);
    else cb(null, pinIp, fam);
  };
  return new Promise<Response>((resolve, reject) => {
    const req = mod.request(
      rawUrl,
      {
        method: 'GET',
        headers: init.headers,
        signal: init.signal,
        // WHY cast: @types/node's LookupFunction models only the all:false callback
        // shape; we also serve the all:true array form (above), so widen it.
        lookup: pinnedLookup as unknown as LookupFunction,
      },
      (res) => {
        const headers = new Headers();
        for (const [k, v] of Object.entries(res.headers)) {
          if (typeof v === 'string') headers.set(k, v);
          else if (Array.isArray(v)) headers.set(k, v.join(', '));
        }
        const code = res.statusCode ?? 0;
        // Response forbids a body for these statuses; drain the socket instead.
        if (code < 200 || code === 204 || code === 205 || code === 304) {
          res.resume();
          resolve(new Response(null, { status: code, headers }));
          return;
        }
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            res.on('data', (c: Buffer) =>
              controller.enqueue(new Uint8Array(c.buffer, c.byteOffset, c.byteLength)),
            );
            res.on('end', () => controller.close());
            res.on('error', (e: Error) => controller.error(e));
          },
          cancel() {
            res.destroy();
          },
        });
        resolve(new Response(stream, { status: code, headers }));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

// Fetch a URL safely: validate before each hop, CONNECT TO THE VALIDATED IP (the
// pin — no TOCTOU), never auto-follow redirects (re-validate the Location), cap
// bytes, gate content-type.
export async function safeFetch(
  rawUrl: string,
  opts: SafeFetchOptions = {},
): Promise<SafeFetchResult> {
  const maxBytes = opts.maxBytes ?? Number(Bun.env['LUNA_WEB_FETCH_MAX_BYTES'] ?? 3_000_000);
  const resolve = opts.resolve ?? defaultResolve;
  const transport: FetchImpl = opts.fetchImpl ?? pinnedFetch;

  let current = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const guard = await assertPublicUrl(current, resolve);
    if (!guard.ok) throw new SafeFetchError('blocked_url', guard.reason);
    // Pin the socket to a deny-list-validated address. Because the connection uses
    // THIS ip (not a fresh resolution), a DNS rebind cannot swap in a private
    // address between the check and the connect — the TOCTOU is closed.
    const pinIp = guard.ips[0]!;

    let res: Response;
    try {
      res = await transport(
        current,
        {
          redirect: 'manual',
          signal: opts.signal,
          headers: { 'user-agent': USER_AGENT, accept: 'text/html, text/plain;q=0.9, */*;q=0.1' },
        },
        pinIp,
      );
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
