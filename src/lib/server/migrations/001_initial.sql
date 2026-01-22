-- FluxArr Initial Schema
-- Migration 001

-- Users & Auth
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user', 'restricted')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- TV Shows (synced from TVMaze)
CREATE TABLE IF NOT EXISTS shows (
  id INTEGER PRIMARY KEY, -- TVMaze ID
  name TEXT NOT NULL,
  slug TEXT,
  type TEXT, -- 'Scripted', 'Animation', 'Reality', etc.
  language TEXT,
  genres TEXT, -- JSON array
  status TEXT, -- 'Running', 'Ended', 'To Be Determined', etc.
  runtime INTEGER,
  average_runtime INTEGER,
  premiered TEXT,
  ended TEXT,
  official_site TEXT,
  schedule_time TEXT,
  schedule_days TEXT, -- JSON array
  rating_average REAL,
  weight INTEGER,
  network_id INTEGER,
  network_name TEXT,
  network_country_name TEXT,
  network_country_code TEXT,
  web_channel_id INTEGER,
  web_channel_name TEXT,
  web_channel_country_code TEXT,
  image_medium TEXT,
  image_original TEXT,
  summary TEXT,
  imdb_id TEXT,
  thetvdb_id INTEGER,
  tvrage_id INTEGER,
  updated_at INTEGER, -- TVMaze timestamp
  synced_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_shows_name ON shows(name);
CREATE INDEX IF NOT EXISTS idx_shows_language ON shows(language);
CREATE INDEX IF NOT EXISTS idx_shows_status ON shows(status);
CREATE INDEX IF NOT EXISTS idx_shows_rating ON shows(rating_average);
CREATE INDEX IF NOT EXISTS idx_shows_premiered ON shows(premiered);
CREATE INDEX IF NOT EXISTS idx_shows_network ON shows(network_name);
CREATE INDEX IF NOT EXISTS idx_shows_web_channel ON shows(web_channel_name);
CREATE INDEX IF NOT EXISTS idx_shows_updated_at ON shows(updated_at);

-- Full-text search for shows
CREATE VIRTUAL TABLE IF NOT EXISTS shows_fts USING fts5(
  name,
  summary,
  content='shows',
  content_rowid='id'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS shows_ai AFTER INSERT ON shows BEGIN
  INSERT INTO shows_fts(rowid, name, summary) VALUES (new.id, new.name, new.summary);
END;

CREATE TRIGGER IF NOT EXISTS shows_ad AFTER DELETE ON shows BEGIN
  INSERT INTO shows_fts(shows_fts, rowid, name, summary) VALUES('delete', old.id, old.name, old.summary);
END;

CREATE TRIGGER IF NOT EXISTS shows_au AFTER UPDATE ON shows BEGIN
  INSERT INTO shows_fts(shows_fts, rowid, name, summary) VALUES('delete', old.id, old.name, old.summary);
  INSERT INTO shows_fts(rowid, name, summary) VALUES (new.id, new.name, new.summary);
END;

-- Saved Filters
CREATE TABLE IF NOT EXISTS filters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  config TEXT NOT NULL, -- JSON: {include: {...}, exclude: {...}}
  is_default INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_filters_user_id ON filters(user_id);

-- Sonarr Configurations
CREATE TABLE IF NOT EXISTS sonarr_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, -- NULL = shared
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  is_default INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sonarr_configs_user_id ON sonarr_configs(user_id);

-- User Restrictions (for restricted users)
CREATE TABLE IF NOT EXISTS user_restrictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  restriction_type TEXT NOT NULL CHECK (restriction_type IN ('genre', 'rating_max', 'language')),
  restriction_value TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_user_restrictions_user_id ON user_restrictions(user_id);

-- Sync metadata
CREATE TABLE IF NOT EXISTS sync_status (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_full_sync TEXT,
  last_incremental_sync TEXT,
  total_shows INTEGER DEFAULT 0,
  is_syncing INTEGER DEFAULT 0,
  sync_progress TEXT -- JSON: {current: n, total: n, phase: 'full'|'incremental'}
);

-- Initialize sync_status with single row
INSERT OR IGNORE INTO sync_status (id) VALUES (1);

-- Schema migrations tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT DEFAULT (datetime('now'))
);
