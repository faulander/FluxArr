-- People table (actors, directors, producers, etc.)
CREATE TABLE IF NOT EXISTS people (
  id INTEGER PRIMARY KEY, -- TVMaze person ID
  name TEXT NOT NULL,
  birthday TEXT,
  deathday TEXT,
  gender TEXT,
  country_name TEXT,
  country_code TEXT,
  image_medium TEXT,
  image_original TEXT,
  updated_at INTEGER,
  synced_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_people_name ON people(name);

-- Show cast (actors and their characters)
CREATE TABLE IF NOT EXISTS show_cast (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  show_id INTEGER NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  character_name TEXT,
  character_image_medium TEXT,
  character_image_original TEXT,
  is_self INTEGER DEFAULT 0,
  is_voice INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  UNIQUE(show_id, person_id, character_name)
);

CREATE INDEX IF NOT EXISTS idx_show_cast_show_id ON show_cast(show_id);
CREATE INDEX IF NOT EXISTS idx_show_cast_person_id ON show_cast(person_id);

-- Show crew (directors, producers, writers, etc.)
CREATE TABLE IF NOT EXISTS show_crew (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  show_id INTEGER NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  crew_type TEXT NOT NULL, -- 'Creator', 'Executive Producer', 'Director', etc.
  UNIQUE(show_id, person_id, crew_type)
);

CREATE INDEX IF NOT EXISTS idx_show_crew_show_id ON show_crew(show_id);
CREATE INDEX IF NOT EXISTS idx_show_crew_person_id ON show_crew(person_id);
CREATE INDEX IF NOT EXISTS idx_show_crew_type ON show_crew(crew_type);
