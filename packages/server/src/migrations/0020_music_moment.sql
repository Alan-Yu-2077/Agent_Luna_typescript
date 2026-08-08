-- v0.45.2 (Initiative 32): the track-change moment's OWN sub-gate state — a cooldown anchor +
-- a daily quota, per session, mirroring the cadence columns' shape. These ADD a second, stricter
-- gate on top of the global proactive account (which a music fire still consumes in full) — they
-- never replace or bypass the first.
ALTER TABLE sessions ADD COLUMN music_last_fire_ms INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN music_quota_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN music_quota_date TEXT NOT NULL DEFAULT '';
