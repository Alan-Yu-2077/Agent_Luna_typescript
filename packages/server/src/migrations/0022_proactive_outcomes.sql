-- v0.45.10 (Initiative 35): the quiet-agency ledger. Every proactive waking records what it
-- became — spoke / quiet (did something without a word) / nothing — because the silent-rate was
-- invisible (M6) and a behavior change nobody can audit is a vibe, not a fix. `note` is the
-- one-line human summary of quiet work (v0.45.11's leaf reads it verbatim); `wandered` marks
-- web-roaming quiet turns for the daily wander budget (local-day counted).
CREATE TABLE proactive_outcomes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ts         INTEGER NOT NULL,
  session_id TEXT NOT NULL,
  kind       TEXT NOT NULL,
  note       TEXT NOT NULL DEFAULT '',
  wandered   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_proactive_outcomes_ts ON proactive_outcomes (ts);
