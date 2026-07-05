-- Skills lifecycle (Initiative 23, v0.32.0). The v0.15.4 `skills` table gains the
-- lifecycle every later version builds on: an audit trail (the soul_audit pattern —
-- the prior state is written BEFORE every mutating write, so a bad overwrite or
-- deprecation is one restoreSkill call to undo), usage counters (recall_skill bumps
-- them; shelf eviction + dream deprecation read them), provenance (who authored the
-- current body: 'saved' = the verify-gated awake tool, 'dream' = distilled in a
-- dream cycle, 'owner' = the workspace editor), and soft deprecation (0 = active —
-- the L3 deleted_ms pattern). Never edits 0009.

CREATE TABLE IF NOT EXISTS skills_audit (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  t_ms               INTEGER NOT NULL,
  name               TEXT NOT NULL,
  prev_description   TEXT NOT NULL,
  prev_body          TEXT NOT NULL,
  prev_source        TEXT NOT NULL,
  prev_verified_ms   INTEGER NOT NULL,
  prev_deprecated_ms INTEGER NOT NULL,
  source             TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_skills_audit_name ON skills_audit (name, id);

ALTER TABLE skills ADD COLUMN used_count    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE skills ADD COLUMN last_used_ms  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE skills ADD COLUMN source        TEXT    NOT NULL DEFAULT 'saved';
ALTER TABLE skills ADD COLUMN deprecated_ms INTEGER NOT NULL DEFAULT 0;
