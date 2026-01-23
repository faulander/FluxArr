-- Sonarr Library Cache
-- Stores shows from all configured Sonarr instances

CREATE TABLE IF NOT EXISTS sonarr_library (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  config_id INTEGER NOT NULL REFERENCES sonarr_configs(id) ON DELETE CASCADE,
  sonarr_id INTEGER NOT NULL,  -- ID in Sonarr
  tvdb_id INTEGER,
  title TEXT NOT NULL,
  status TEXT,
  monitored INTEGER DEFAULT 1,
  episode_count INTEGER DEFAULT 0,
  episode_file_count INTEGER DEFAULT 0,
  size_on_disk INTEGER DEFAULT 0,
  path TEXT,
  synced_at TEXT DEFAULT (datetime('now')),
  UNIQUE(config_id, sonarr_id)
);

CREATE INDEX IF NOT EXISTS idx_sonarr_library_tvdb_id ON sonarr_library(tvdb_id);
CREATE INDEX IF NOT EXISTS idx_sonarr_library_config_id ON sonarr_library(config_id);

-- Track last sync time per config
ALTER TABLE sonarr_configs ADD COLUMN last_library_sync TEXT;
