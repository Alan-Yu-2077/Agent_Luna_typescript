CREATE TABLE embeddings_cache (
  rowid     INTEGER PRIMARY KEY AUTOINCREMENT,
  hash      TEXT NOT NULL UNIQUE,
  dim       INTEGER NOT NULL,
  embedding BLOB NOT NULL
);
