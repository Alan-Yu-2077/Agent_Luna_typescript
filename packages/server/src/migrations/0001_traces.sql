CREATE TABLE traces (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  schema_v     INTEGER NOT NULL,
  trace_id     TEXT NOT NULL,
  turn_id      TEXT NOT NULL,
  session_id   TEXT NOT NULL,
  kind         TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  t_ms         INTEGER NOT NULL
);
CREATE INDEX idx_traces_turn ON traces (turn_id, t_ms);
CREATE INDEX idx_traces_session ON traces (session_id, t_ms);
