-- v0.24.2 (Initiative 17 close): Luna's self-writable proactive style — a single row.
-- The activeness lever (aloof/balanced/clingy) scales cadence WITHIN the operator floor/ceiling
-- (the safety kernel she cannot breach); voice_notes color her proactive openers. Written by the
-- set_proactive_style tool.
CREATE TABLE proactive_style (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  activeness  TEXT NOT NULL DEFAULT 'balanced',
  voice_notes TEXT NOT NULL DEFAULT ''
);
INSERT INTO proactive_style (id) VALUES (1);
