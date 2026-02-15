-- Add premium flag to OMDB config for higher API limits
ALTER TABLE omdb_config ADD COLUMN premium INTEGER DEFAULT 0;
