import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { setMemoryDb } from '../../memory/sessionStore';
import { cachedSafeFetch } from './webCache';
import type { FetchImpl, Resolver } from './safeFetch';

const publicResolve: Resolver = async () => ['93.184.216.34'];
const htmlResponse = (body: string): Response =>
  new Response(body, { status: 200, headers: { 'content-type': 'text/html' } });

const savedCache = Bun.env['LUNA_WEB_CACHE'];
let db: Database;

beforeEach(() => {
  db = new Database(':memory:', { strict: true });
  db.exec(
    readFileSync(join(import.meta.dir, '..', '..', 'migrations', '0012_web_cache.sql'), 'utf8'),
  );
  setMemoryDb(db);
  Bun.env['LUNA_WEB_CACHE'] = '1';
});

afterEach(() => {
  setMemoryDb(null);
  if (savedCache === undefined) delete Bun.env['LUNA_WEB_CACHE'];
  else Bun.env['LUNA_WEB_CACHE'] = savedCache;
  db.close(false);
});

describe('cachedSafeFetch (v0.18.2)', () => {
  test('migration 0012 applies and a second fetch of the same url is served from cache', async () => {
    let networkCalls = 0;
    const fetchImpl: FetchImpl = async () => {
      networkCalls += 1;
      return htmlResponse('<html><body>cached page</body></html>');
    };
    const opts = { resolve: publicResolve, fetchImpl };

    const r1 = await cachedSafeFetch('http://example.com/p', opts);
    const r2 = await cachedSafeFetch('http://example.com/p', opts);
    expect(networkCalls).toBe(1); // second served from web_cache
    expect(r2.body).toBe(r1.body);
    expect(r2.finalUrl).toBe('http://example.com/p');
  });

  test('a NEW url is a miss → still runs safeFetch (SSRF validation)', async () => {
    let networkCalls = 0;
    const fetchImpl: FetchImpl = async () => {
      networkCalls += 1;
      return htmlResponse('<html><body>x</body></html>');
    };
    const opts = { resolve: publicResolve, fetchImpl };
    await cachedSafeFetch('http://example.com/a', opts);
    await cachedSafeFetch('http://example.com/b', opts);
    expect(networkCalls).toBe(2);
  });

  test('a cache hit never bypasses the SSRF guard for a blocked url (miss → safeFetch rejects)', async () => {
    const opts = { resolve: publicResolve, fetchImpl: async () => htmlResponse('x') };
    await expect(cachedSafeFetch('http://127.0.0.1/', opts)).rejects.toMatchObject({
      code: 'blocked_url',
    });
    // nothing was stored for the blocked url
    const row = db.prepare('SELECT COUNT(*) AS n FROM web_cache').get() as { n: number };
    expect(row.n).toBe(0);
  });

  test('a TTL-expired row triggers a re-fetch, not a stale serve', async () => {
    // pre-seed a stale row, backdated well past the 15-min TTL
    db.prepare(
      'INSERT INTO web_cache (url, fetched_ms, status, content_type, body, final_url) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(
      'http://example.com/stale',
      Date.now() - 1_000_000,
      200,
      'text/html',
      'OLD BODY',
      'http://example.com/stale',
    );
    let networkCalls = 0;
    const fetchImpl: FetchImpl = async () => {
      networkCalls += 1;
      return htmlResponse('<html><body>FRESH BODY</body></html>');
    };
    const r = await cachedSafeFetch('http://example.com/stale', {
      resolve: publicResolve,
      fetchImpl,
    });
    expect(networkCalls).toBe(1); // stale row → re-fetched through safeFetch
    expect(r.body).toContain('FRESH BODY');
    expect(r.body).not.toContain('OLD BODY');
  });
});
