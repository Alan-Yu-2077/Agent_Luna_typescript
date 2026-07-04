-- v0.30.0 (Initiative 22, 1/4): the soul file substrate — a single DB-stored
-- persona split by authorship into a fixed core (dev-authored, git-seeded, Luna-
-- immutable) and an evolving section (Luna-authored via the dream). Dark launch:
-- populated by seedSoulOnBoot(), but nothing reads it yet — core_memory stays
-- the source of truth for the rendered prompt until v0.30.1.
CREATE TABLE soul (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  fixed_text    TEXT NOT NULL,
  fixed_hash    TEXT NOT NULL,
  evolving_self TEXT NOT NULL DEFAULT '',
  evolving_bond TEXT NOT NULL DEFAULT '',
  updated_ms    INTEGER NOT NULL
);

-- Mirrors core_memory_audit so the evolving section keeps audit + restore(n).
CREATE TABLE soul_audit (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  t_ms       INTEGER NOT NULL,
  prev_self  TEXT NOT NULL,
  prev_bond  TEXT NOT NULL,
  source     TEXT NOT NULL
);
