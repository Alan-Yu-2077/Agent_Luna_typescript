-- Embedding-cache reset (v0.32.1). The cache held rows under TWO key schemes:
-- retrieve() writes model-namespaced embedCacheKey rows (since v0.20.5), while the
-- dream's rag_refresh kept writing bare contentHash rows — unreadable by recall
-- (the dead-work bug fixed in v0.32.1) and, with the fix, orphaned forever (the
-- two schemes are indistinguishable sha256 hex, so they can't be selectively
-- purged). This is a CACHE: wiping it costs only lazy re-embedding (bounded at
-- 64/turn on the hot path; the next dream's rag_refresh re-warms the rest under
-- the unified key).
DELETE FROM embeddings_cache;
