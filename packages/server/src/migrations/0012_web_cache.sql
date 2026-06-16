-- Initiative 11 (v0.18.2): optional fetch cache for web_fetch (LUNA_WEB_CACHE).
-- Stores ONLY already-validated (SSRF-passed) fetches keyed by url; cachedSafeFetch
-- serves a hit under a short TTL without going to network, but a miss still runs
-- the full safeFetch SSRF guard, so a cache hit never bypasses validation.
CREATE TABLE IF NOT EXISTS web_cache (
  url          TEXT PRIMARY KEY,
  fetched_ms   INTEGER NOT NULL,
  status       INTEGER NOT NULL,
  content_type TEXT NOT NULL,
  body         TEXT NOT NULL,
  final_url    TEXT NOT NULL
);
