-- Movies table (TMDB as primary data source)
CREATE TABLE movies (
  id INTEGER PRIMARY KEY,              -- TMDB movie ID
  title TEXT NOT NULL,
  original_title TEXT,
  slug TEXT,
  language TEXT,                        -- original_language
  genres TEXT,                          -- JSON array of genre names
  status TEXT,                          -- Released, Post Production, etc.
  runtime INTEGER,
  release_date TEXT,
  revenue INTEGER,
  budget INTEGER,
  vote_average REAL,                    -- TMDB rating (0-10)
  vote_count INTEGER,
  popularity REAL,
  imdb_id TEXT,
  imdb_rating REAL,
  imdb_rating_updated_at TEXT,
  poster_path TEXT,                     -- TMDB relative path
  backdrop_path TEXT,
  overview TEXT,
  tagline TEXT,
  production_companies TEXT,            -- JSON array
  production_countries TEXT,            -- JSON array of country codes
  spoken_languages TEXT,                -- JSON array
  updated_at TEXT,
  synced_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_movies_title ON movies(title);
CREATE INDEX idx_movies_language ON movies(language);
CREATE INDEX idx_movies_status ON movies(status);
CREATE INDEX idx_movies_vote_average ON movies(vote_average);
CREATE INDEX idx_movies_imdb_rating ON movies(imdb_rating);
CREATE INDEX idx_movies_release_date ON movies(release_date);
CREATE INDEX idx_movies_popularity ON movies(popularity);

-- FTS5 for search
CREATE VIRTUAL TABLE movies_fts USING fts5(title, overview, content='movies', content_rowid='id');

-- FTS triggers to keep index in sync
CREATE TRIGGER movies_fts_insert AFTER INSERT ON movies BEGIN
  INSERT INTO movies_fts(rowid, title, overview) VALUES (new.id, new.title, new.overview);
END;

CREATE TRIGGER movies_fts_delete AFTER DELETE ON movies BEGIN
  INSERT INTO movies_fts(movies_fts, rowid, title, overview) VALUES ('delete', old.id, old.title, old.overview);
END;

CREATE TRIGGER movies_fts_update AFTER UPDATE ON movies BEGIN
  INSERT INTO movies_fts(movies_fts, rowid, title, overview) VALUES ('delete', old.id, old.title, old.overview);
  INSERT INTO movies_fts(rowid, title, overview) VALUES (new.id, new.title, new.overview);
END;

-- Sync status for movies (parallel to sync_status for shows)
CREATE TABLE movie_sync_status (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_full_sync TEXT,
  last_incremental_sync TEXT,
  total_movies INTEGER DEFAULT 0,
  is_syncing INTEGER DEFAULT 0,
  sync_progress TEXT
);

INSERT OR IGNORE INTO movie_sync_status (id) VALUES (1);
