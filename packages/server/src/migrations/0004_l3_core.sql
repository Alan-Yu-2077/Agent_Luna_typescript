CREATE TABLE l3_facts (
  id          TEXT PRIMARY KEY,
  category    TEXT NOT NULL,
  text        TEXT NOT NULL,
  dedup_key   TEXT NOT NULL,
  confidence  TEXT,
  created_ms  INTEGER NOT NULL,
  expires_ms  INTEGER,
  deleted_ms  INTEGER
);
CREATE INDEX idx_l3_category ON l3_facts (category, created_ms);
CREATE INDEX idx_l3_dedup ON l3_facts (dedup_key);

CREATE TABLE core_memory (
  id                  INTEGER PRIMARY KEY CHECK (id = 1),
  self_state          TEXT NOT NULL,
  relationship_status TEXT NOT NULL,
  updated_ms          INTEGER NOT NULL
);
INSERT INTO core_memory (id, self_state, relationship_status, updated_ms) VALUES (1, '', '', 0);

CREATE TABLE core_memory_audit (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  t_ms              INTEGER NOT NULL,
  prev_self_state   TEXT NOT NULL,
  prev_relationship TEXT NOT NULL,
  source            TEXT NOT NULL
);
