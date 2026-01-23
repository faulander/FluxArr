-- Track when IMDB ratings were last fetched for smart re-sync
-- This allows us to prioritize rating updates based on show status

-- Add column to track when IMDB rating was last fetched from OMDB
ALTER TABLE shows ADD COLUMN imdb_rating_updated_at TEXT;

-- Index for efficient querying of shows needing rating updates
CREATE INDEX IF NOT EXISTS idx_shows_imdb_rating_updated ON shows(imdb_rating_updated_at);

-- Combined index for priority queries (status + last update)
CREATE INDEX IF NOT EXISTS idx_shows_status_imdb_update ON shows(status, imdb_rating_updated_at);
