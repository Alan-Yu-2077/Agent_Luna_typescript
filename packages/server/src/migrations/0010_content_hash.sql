-- A2 (v0.16.1): persist the recall content hash so retrieve() reads it back
-- instead of re-sha256-hashing every candidate on every turn. Nullable, so
-- pre-existing rows simply fall back to on-the-fly hashing in recall; new rows
-- carry the hash from insert.
ALTER TABLE l2_turns ADD COLUMN content_hash TEXT;
ALTER TABLE l3_facts ADD COLUMN content_hash TEXT;
