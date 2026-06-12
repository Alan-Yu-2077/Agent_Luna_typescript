CREATE TABLE dream_state (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  is_dreaming   INTEGER NOT NULL DEFAULT 0,
  current_step  TEXT,
  cycle_id      TEXT,
  last_dream_ms INTEGER,
  cycle_count   INTEGER NOT NULL DEFAULT 0
);
INSERT INTO dream_state (id, is_dreaming, current_step, cycle_id, last_dream_ms, cycle_count)
VALUES (1, 0, NULL, NULL, NULL, 0);

CREATE TABLE dream_reports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  cycle_id    TEXT NOT NULL,
  started_ms  INTEGER NOT NULL,
  ended_ms    INTEGER,
  report_json TEXT NOT NULL
);

CREATE TABLE diaries (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  kind         TEXT NOT NULL,
  period_key   TEXT NOT NULL,
  text         TEXT NOT NULL,
  generated_ms INTEGER NOT NULL,
  UNIQUE (kind, period_key)
);
