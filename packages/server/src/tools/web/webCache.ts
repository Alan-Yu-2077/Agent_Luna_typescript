import { getMemoryDb } from '../../memory/sessionStore';
import { safeFetch, type SafeFetchOptions, type SafeFetchResult } from './safeFetch';

// Optional fetch cache (Initiative 11, v0.18.2) wrapped AROUND safeFetch. On a
// miss the full SSRF guard runs (safeFetch validates + throws on a blocked URL),
// and only a successful, already-validated fetch is stored — so a cache hit
// (same url, within TTL) never bypasses validation. Default OFF (LUNA_WEB_CACHE).

export function webCacheEnabled(): boolean {
  return Bun.env['LUNA_WEB_CACHE'] === '1';
}

function ttlMs(): number {
  return Number(Bun.env['LUNA_WEB_CACHE_TTL_MS'] ?? 900_000); // 15 min (Anthropic's fetch TTL)
}

type CacheRow = {
  fetched_ms: number;
  status: number;
  content_type: string;
  body: string;
  final_url: string;
};

export async function cachedSafeFetch(
  url: string,
  opts: SafeFetchOptions = {},
): Promise<SafeFetchResult> {
  const db = getMemoryDb();
  if (!db) return safeFetch(url, opts);

  const row = db.prepare('SELECT * FROM web_cache WHERE url = ?').get(url) as CacheRow | null;
  if (row && Date.now() - row.fetched_ms < ttlMs()) {
    return {
      status: row.status,
      contentType: row.content_type,
      body: row.body,
      finalUrl: row.final_url,
    };
  }

  const result = await safeFetch(url, opts); // SSRF-guarded; throws on a blocked url → nothing stored
  db.prepare(
    'INSERT OR REPLACE INTO web_cache (url, fetched_ms, status, content_type, body, final_url) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(url, Date.now(), result.status, result.contentType, result.body, result.finalUrl);
  return result;
}
