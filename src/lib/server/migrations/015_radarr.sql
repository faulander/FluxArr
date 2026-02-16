-- Radarr configuration (parallel to sonarr_configs)
CREATE TABLE radarr_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  is_default INTEGER DEFAULT 0,
  last_library_sync TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_radarr_configs_user_id ON radarr_configs(user_id);

-- Radarr library cache (parallel to sonarr_library)
CREATE TABLE radarr_library (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  config_id INTEGER NOT NULL REFERENCES radarr_configs(id) ON DELETE CASCADE,
  radarr_id INTEGER NOT NULL,
  tmdb_id INTEGER,
  title TEXT,
  status TEXT,
  monitored INTEGER DEFAULT 1,
  has_file INTEGER DEFAULT 0,
  size_on_disk INTEGER DEFAULT 0,
  path TEXT,
  synced_at TEXT DEFAULT (datetime('now')),
  UNIQUE(config_id, radarr_id)
);

CREATE INDEX idx_radarr_library_tmdb_id ON radarr_library(tmdb_id);
CREATE INDEX idx_radarr_library_config_id ON radarr_library(config_id);

-- Movie requests (parallel to requests table for shows)
CREATE TABLE movie_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  radarr_config_id INTEGER NOT NULL REFERENCES radarr_configs(id) ON DELETE CASCADE,
  radarr_movie_id INTEGER,
  tmdb_id INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'added', 'downloading', 'completed', 'failed')),
  requested_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_movie_requests_user_id ON movie_requests(user_id);
CREATE INDEX idx_movie_requests_movie_id ON movie_requests(movie_id);
CREATE INDEX idx_movie_requests_radarr_config_id ON movie_requests(radarr_config_id);
CREATE INDEX idx_movie_requests_status ON movie_requests(status);

CREATE TRIGGER movie_requests_updated_at
AFTER UPDATE ON movie_requests
BEGIN
  UPDATE movie_requests SET updated_at = datetime('now') WHERE id = NEW.id;
END;
