import { describe, expect, test } from 'bun:test';
import {
  assertPublicUrl,
  isBlockedIp,
  makePinnedLookup,
  safeFetch,
  type FetchImpl,
  type Resolver,
} from './safeFetch';

const neverResolve: Resolver = async () => {
  throw new Error('resolver must not be called for an IP literal');
};
const publicResolve: Resolver = async () => ['93.184.216.34'];

describe('assertPublicUrl — SSRF deny-list (the keystone)', () => {
  // Each normalizes to an IP literal (the WHATWG URL parser collapses
  // decimal/hex/octal IPv4), so the resolver is never consulted.
  const blockedLiterals = [
    'http://127.0.0.1/', // loopback
    'http://10.0.0.5/', // RFC1918
    'http://192.168.1.1/', // RFC1918
    'http://172.16.5.5/', // RFC1918
    'http://169.254.169.254/', // cloud metadata
    'http://[::1]/', // IPv6 loopback
    'http://[fc00::1]/', // IPv6 ULA
    'http://[fe80::1]/', // IPv6 link-local
    'http://[::ffff:127.0.0.1]/', // IPv4-mapped loopback
    'http://2130706433/', // decimal 127.0.0.1
    'http://0177.0.0.1/', // octal 127.0.0.1
    'http://0x7f.0.0.1/', // hex 127.0.0.1
    'http://0.0.0.0/', // unspecified
  ];
  for (const u of blockedLiterals) {
    test(`blocks ${u}`, async () => {
      const r = await assertPublicUrl(u, neverResolve);
      expect(r.ok).toBe(false);
    });
  }

  test('blocks a hostname that RESOLVES to a private/metadata IP', async () => {
    expect((await assertPublicUrl('http://internal.corp/', async () => ['10.1.2.3'])).ok).toBe(
      false,
    );
    expect((await assertPublicUrl('http://localhost/', async () => ['127.0.0.1'])).ok).toBe(false);
    expect(
      (await assertPublicUrl('http://metadata.google/', async () => ['169.254.169.254'])).ok,
    ).toBe(false);
    // any one bad record in the A/AAAA set fails the whole host
    expect(
      (await assertPublicUrl('http://mixed.example/', async () => ['93.184.216.34', '10.0.0.1']))
        .ok,
    ).toBe(false);
  });

  test('blocks non-http(s) schemes', async () => {
    expect((await assertPublicUrl('file:///etc/passwd', neverResolve)).ok).toBe(false);
    expect((await assertPublicUrl('ftp://example.com/', neverResolve)).ok).toBe(false);
    expect((await assertPublicUrl('gopher://example.com/', neverResolve)).ok).toBe(false);
  });

  test('blocks embedded credentials', async () => {
    expect((await assertPublicUrl('http://user:pass@example.com/', publicResolve)).ok).toBe(false);
  });

  test('blocks an over-long url (>2048)', async () => {
    const long = `http://example.com/${'a'.repeat(2100)}`;
    expect((await assertPublicUrl(long, publicResolve)).ok).toBe(false);
  });

  test('accepts a normal public host + a public IP literal', async () => {
    expect((await assertPublicUrl('https://example.com/page', publicResolve)).ok).toBe(true);
    expect((await assertPublicUrl('http://93.184.216.34/', neverResolve)).ok).toBe(true);
  });
});

describe('isBlockedIp (pure)', () => {
  test('classifies private/loopback/metadata as blocked, public as allowed', () => {
    for (const ip of [
      '127.0.0.1',
      '10.0.0.1',
      '192.168.0.1',
      '169.254.169.254',
      '::1',
      'fc00::1',
    ]) {
      expect(isBlockedIp(ip)).toBe(true);
    }
    for (const ip of ['93.184.216.34', '8.8.8.8', '2606:4700::1111']) {
      expect(isBlockedIp(ip)).toBe(false);
    }
    expect(isBlockedIp('not-an-ip')).toBe(true); // fail-closed
    // RFC2544 benchmarking / Clash-Surge fake-IP proxy pool — intentionally allowed
    // (not internal infra; blocking it breaks web_fetch on every proxied host).
    expect(isBlockedIp('198.18.0.252')).toBe(false);
  });

  // Review fix: IPv6 transition forms that wrap an internal v4 must be decoded +
  // blocked, not just the ::ffff: mapped form.
  test('NAT64 (64:ff9b::/96) and 6to4 (2002::/16) wrapping an internal v4 are blocked', () => {
    expect(isBlockedIp('64:ff9b::a9fe:a9fe')).toBe(true); // NAT64 of 169.254.169.254 (metadata)
    expect(isBlockedIp('64:ff9b::7f00:1')).toBe(true); // NAT64 of 127.0.0.1
    expect(isBlockedIp('2002:7f00:1::1')).toBe(true); // 6to4 of 127.0.0.1
    expect(isBlockedIp('2002:a9fe:a9fe::1')).toBe(true); // 6to4 of 169.254.169.254
    expect(isBlockedIp('2002:0a00:1::')).toBe(true); // 6to4 of 10.0.0.1
    // the same transition prefixes wrapping a PUBLIC v4 stay allowed
    expect(isBlockedIp('2002:5db8:d822::1')).toBe(false); // 6to4 of 93.184.216.34
    expect(isBlockedIp('64:ff9b::5db8:d822')).toBe(false); // NAT64 of 93.184.216.34
  });
});

const htmlResponse = (body: string, status = 200): Response =>
  new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });

describe('safeFetch — fetch with re-validation + caps', () => {
  test('a public text/html page is fetched and returned', async () => {
    const fetchImpl: FetchImpl = async () => htmlResponse('<html><body>hi there</body></html>');
    const r = await safeFetch('http://example.com/p', { resolve: publicResolve, fetchImpl });
    expect(r.status).toBe(200);
    expect(r.body).toContain('hi there');
    expect(r.finalUrl).toBe('http://example.com/p');
  });

  test('a redirect to a metadata IP is re-validated and rejected, not followed', async () => {
    let reached169 = false;
    const fetchImpl: FetchImpl = async (url) => {
      if (url.includes('169.254')) {
        reached169 = true;
        return htmlResponse('SECRET');
      }
      return new Response('', { status: 302, headers: { location: 'http://169.254.169.254/' } });
    };
    await expect(
      safeFetch('http://example.com/', { resolve: publicResolve, fetchImpl }),
    ).rejects.toMatchObject({ code: 'blocked_url' });
    expect(reached169).toBe(false);
  });

  test('the transport is pinned to the validated IP (closes the rebinding TOCTOU)', async () => {
    // a single resolution returns a public IP; the transport must be handed THAT
    // exact ip as the pin target, so the socket cannot be re-resolved to a private
    // address between the check and the connect.
    let pinnedTo = '';
    const resolve: Resolver = async () => ['93.184.216.34'];
    const fetchImpl: FetchImpl = async (_url, _init, pinIp) => {
      pinnedTo = pinIp;
      return htmlResponse('<html><body>ok</body></html>');
    };
    const r = await safeFetch('http://pinme.example/', { resolve, fetchImpl });
    expect(r.status).toBe(200);
    expect(pinnedTo).toBe('93.184.216.34'); // connected to the validated IP, not a re-resolve
  });

  test('a host that resolves to a private IP is rejected before any connect', async () => {
    let fetched = false;
    const resolve: Resolver = async () => ['10.0.0.5'];
    const fetchImpl: FetchImpl = async () => {
      fetched = true;
      return htmlResponse('x');
    };
    await expect(
      safeFetch('http://internal.example/', { resolve, fetchImpl }),
    ).rejects.toMatchObject({ code: 'blocked_url' });
    expect(fetched).toBe(false);
  });

  test('a body over maxBytes aborts mid-stream → too_large', async () => {
    const fetchImpl: FetchImpl = async () => htmlResponse('x'.repeat(5000));
    await expect(
      safeFetch('http://example.com/', { resolve: publicResolve, fetchImpl, maxBytes: 1000 }),
    ).rejects.toMatchObject({ code: 'too_large' });
  });

  test('a non-text content-type is rejected', async () => {
    const fetchImpl: FetchImpl = async () =>
      new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    await expect(
      safeFetch('http://example.com/', { resolve: publicResolve, fetchImpl }),
    ).rejects.toMatchObject({ code: 'unsupported_type' });
  });

  test('an http error status is a fetch_failed', async () => {
    const fetchImpl: FetchImpl = async () => htmlResponse('nope', 500);
    await expect(
      safeFetch('http://example.com/', { resolve: publicResolve, fetchImpl }),
    ).rejects.toMatchObject({ code: 'fetch_failed' });
  });

  test('a redirect loop exceeding the hop cap → too_many_redirects', async () => {
    const fetchImpl: FetchImpl = async (url) =>
      new Response('', {
        status: 302,
        headers: { location: `${url}x` }, // always redirects deeper (public host)
      });
    await expect(
      safeFetch('http://example.com/', { resolve: publicResolve, fetchImpl }),
    ).rejects.toMatchObject({ code: 'too_many_redirects' });
  });
});

// v0.20.9 — the DNS pin is the single most security-critical line (the rebinding
// defense). Unit-test that BOTH node lookup callback shapes return ONLY the pinned
// IP, ignoring the hostname — a broken branch would silently reopen SSRF.
describe('makePinnedLookup (DNS pin)', () => {
  type Cb = (...a: unknown[]) => void;
  type Lookup = (host: string, opts: { all?: boolean } | undefined, cb: Cb) => void;

  test('all:true (array form, Bun) returns only the pinned IPv4', () => {
    const lookup = makePinnedLookup('93.184.216.34') as unknown as Lookup;
    let got: unknown;
    lookup('attacker-controlled.example.com', { all: true }, (_e, addrs) => {
      got = addrs;
    });
    expect(got).toEqual([{ address: '93.184.216.34', family: 4 }]);
  });

  test('all:false (single form) returns only the pinned IPv4', () => {
    const lookup = makePinnedLookup('93.184.216.34') as unknown as Lookup;
    let addr: unknown;
    let fam: unknown;
    lookup('attacker-controlled.example.com', undefined, (_e, a, f) => {
      addr = a;
      fam = f;
    });
    expect(addr).toBe('93.184.216.34');
    expect(fam).toBe(4);
  });

  test('an IPv6 pin reports family 6', () => {
    const lookup = makePinnedLookup('2606:2800:220:1:248:1893:25c8:1946') as unknown as Lookup;
    let got: unknown;
    lookup('x', { all: true }, (_e, addrs) => {
      got = addrs;
    });
    expect((got as { family: number }[])[0]?.family).toBe(6);
  });
});
