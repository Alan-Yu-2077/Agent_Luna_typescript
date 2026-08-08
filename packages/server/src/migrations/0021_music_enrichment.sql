-- v0.45.3 (Initiative 32): the enrichment cache — lyrics are immutable, so a track identity is
-- fetched from the network AT MOST ONCE, ever (including the negative case: song_id NULL means
-- "searched, nothing passed the confidence gate" and is cached too, so a cold/delisted song does
-- not re-search on every replay). Keyed by the CLI's trackIdentity hash.
CREATE TABLE music_enrichment (
  identity        TEXT PRIMARY KEY,
  song_id         INTEGER,
  matched_title   TEXT NOT NULL DEFAULT '',
  matched_artist  TEXT NOT NULL DEFAULT '',
  lyric_lrc       TEXT NOT NULL DEFAULT '',
  comments_json   TEXT NOT NULL DEFAULT '[]',
  fetched_ms      INTEGER NOT NULL
);
