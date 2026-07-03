-- v0.27.1: operator settings pinned from the UI. Key-value (NOT the singleton-row pattern of
-- proactive_style): only keys the user has actually touched get a row — an absent row means
-- "follow env/default", which is what makes the reset-to-default semantic possible.
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_ms INTEGER NOT NULL
);
