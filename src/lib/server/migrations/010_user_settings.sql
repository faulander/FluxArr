-- User Settings (theme preferences, etc.)
CREATE TABLE IF NOT EXISTS user_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  primary_color_light TEXT DEFAULT '#000000',
  primary_color_dark TEXT DEFAULT '#ffffff',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
