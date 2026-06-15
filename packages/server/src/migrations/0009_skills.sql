-- Skill library (Initiative 8, v0.15.4). A skill = a verified, reusable procedure
-- Luna can save and recall later (the Voyager/Hermes pattern). save_skill runs the
-- verify loop (the test suite) BEFORE the INSERT, so only skills saved against a
-- green workspace enter the library. Skills are DATA the model reuses on recall —
-- never auto-executed code. Versioned migration, never an in-place schema edit.
CREATE TABLE skills (
  name        TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_ms  INTEGER NOT NULL,
  verified_ms INTEGER NOT NULL
);

CREATE INDEX idx_skills_verified ON skills (verified_ms);
