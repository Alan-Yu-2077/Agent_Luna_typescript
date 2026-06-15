-- Repo-map symbol cache (Initiative 8, v0.15.3). mtime-keyed per-file outline so
-- repo_map / find_symbol re-parse only changed files. symbols_json is the JSON
-- array of extracted symbols for the file; mtime_ms is the file mtime at parse
-- time (the cache key — a newer mtime invalidates the row). Versioned migration,
-- never an in-place schema edit (the Python drift bug we avoid).
CREATE TABLE repo_map (
  path        TEXT PRIMARY KEY,
  mtime_ms    INTEGER NOT NULL,
  size        INTEGER NOT NULL,
  symbols_json TEXT NOT NULL,
  parsed_ms   INTEGER NOT NULL
);
