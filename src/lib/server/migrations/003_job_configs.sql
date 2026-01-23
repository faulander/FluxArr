-- Job configuration table
CREATE TABLE IF NOT EXISTS job_configs (
  id TEXT PRIMARY KEY,
  enabled INTEGER DEFAULT 1,
  interval_minutes INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Trigger to update updated_at
CREATE TRIGGER IF NOT EXISTS job_configs_updated_at
AFTER UPDATE ON job_configs
BEGIN
  UPDATE job_configs SET updated_at = datetime('now') WHERE id = NEW.id;
END;
