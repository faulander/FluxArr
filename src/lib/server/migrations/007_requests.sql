-- Requests table - tracks shows added through FluxArr
CREATE TABLE IF NOT EXISTS requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  show_id INTEGER NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  sonarr_config_id INTEGER NOT NULL REFERENCES sonarr_configs(id) ON DELETE CASCADE,
  sonarr_series_id INTEGER, -- Sonarr's internal ID for the series
  tvdb_id INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'added', 'downloading', 'completed', 'failed')),
  requested_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_requests_user_id ON requests(user_id);
CREATE INDEX IF NOT EXISTS idx_requests_show_id ON requests(show_id);
CREATE INDEX IF NOT EXISTS idx_requests_sonarr_config_id ON requests(sonarr_config_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);

-- Trigger to update updated_at
CREATE TRIGGER IF NOT EXISTS requests_updated_at
AFTER UPDATE ON requests
BEGIN
  UPDATE requests SET updated_at = datetime('now') WHERE id = NEW.id;
END;
