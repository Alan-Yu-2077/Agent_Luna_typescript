CREATE TABLE sessions (
  id           TEXT PRIMARY KEY,
  turn_seq     INTEGER NOT NULL DEFAULT 0,
  history_json TEXT NOT NULL DEFAULT '[]',
  updated_ms   INTEGER NOT NULL
);

CREATE TABLE l2_turns (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id     TEXT NOT NULL,
  turn_id        TEXT NOT NULL,
  t_ms           INTEGER NOT NULL,
  user_text      TEXT NOT NULL,
  assistant_text TEXT NOT NULL,
  raw_json       TEXT NOT NULL
);
CREATE INDEX idx_l2_session_time ON l2_turns (session_id, t_ms);
