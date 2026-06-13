-- Proactive cadence governor (Initiative 5, v0.10.2). Persisted on the session
-- row so a restart never resets timing (Python v0.47.3 lesson: a state machine
-- with timing must survive restarts or it fires bursts on boot).
ALTER TABLE sessions ADD COLUMN proactive_phase      TEXT    NOT NULL DEFAULT 'engaged';
ALTER TABLE sessions ADD COLUMN proactive_quota_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN proactive_quota_date TEXT    NOT NULL DEFAULT '';
ALTER TABLE sessions ADD COLUMN proactive_last_ms    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN proactive_nudges     INTEGER NOT NULL DEFAULT 0;
