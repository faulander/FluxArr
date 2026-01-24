-- Show Changes Log (tracks changes during sync)
CREATE TABLE IF NOT EXISTS show_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  show_id INTEGER NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL, -- 'new', 'updated', 'status_change', 'rating_change', 'ended'
  field_name TEXT, -- which field changed (null for 'new')
  old_value TEXT,
  new_value TEXT,
  detected_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_show_changes_detected_at ON show_changes(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_show_changes_show_id ON show_changes(show_id);
CREATE INDEX IF NOT EXISTS idx_show_changes_type ON show_changes(change_type);
