-- OMDB configuration for IMDB ratings
CREATE TABLE IF NOT EXISTS omdb_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  api_key TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Add IMDB rating column to shows
ALTER TABLE shows ADD COLUMN imdb_rating REAL;

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_shows_imdb_rating ON shows(imdb_rating);
