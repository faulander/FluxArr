// OMDB API client for fetching IMDB ratings
// API documentation: https://www.omdbapi.com/

import { query } from './db';

interface OMDBResponse {
  Response: 'True' | 'False';
  Error?: string;
  Title?: string;
  Year?: string;
  imdbRating?: string;
  imdbID?: string;
}

interface OMDBConfig {
  id: number;
  api_key: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

export function getOMDBConfig(): OMDBConfig | null {
  return query.get<OMDBConfig>(`SELECT * FROM omdb_config WHERE id = 1`) || null;
}

export function saveOMDBConfig(apiKey: string, enabled: boolean): void {
  const existing = getOMDBConfig();

  if (existing) {
    query.run(
      `UPDATE omdb_config SET api_key = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1`,
      [apiKey, enabled ? 1 : 0]
    );
  } else {
    query.run(`INSERT INTO omdb_config (id, api_key, enabled) VALUES (1, ?, ?)`, [
      apiKey,
      enabled ? 1 : 0
    ]);
  }
}

export function isOMDBEnabled(): boolean {
  const config = getOMDBConfig();
  return config !== null && config.enabled === 1 && config.api_key.length > 0;
}

export async function testOMDBConnection(
  apiKey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Test with a known IMDB ID (Breaking Bad)
    const response = await fetch(`https://www.omdbapi.com/?apikey=${apiKey}&i=tt0903747`);
    const data: OMDBResponse = await response.json();

    if (data.Response === 'True') {
      return { success: true };
    } else {
      return { success: false, error: data.Error || 'Invalid API key' };
    }
  } catch (error) {
    return { success: false, error: 'Failed to connect to OMDB API' };
  }
}

export async function fetchIMDBRating(imdbId: string, apiKey: string): Promise<number | null> {
  try {
    const response = await fetch(`https://www.omdbapi.com/?apikey=${apiKey}&i=${imdbId}`);
    const data: OMDBResponse = await response.json();

    if (data.Response === 'True' && data.imdbRating && data.imdbRating !== 'N/A') {
      const rating = parseFloat(data.imdbRating);
      return isNaN(rating) ? null : rating;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Smart IMDB ratings sync with priority-based updates
 *
 * Always uses up to the limit. Priority determines ORDER:
 * 1. Shows with no rating yet (never fetched)
 * 2. Running/In Development shows (sorted by staleness)
 * 3. Recently ended shows within 2 years (sorted by staleness)
 * 4. Older ended shows 2-5 years (sorted by staleness)
 * 5. Very old shows 5+ years (sorted by staleness, lowest priority)
 *
 * Within each priority, shows are sorted by how long since last update.
 */
export async function syncIMDBRatings(
  limit: number = 100
): Promise<{ updated: number; errors: number }> {
  const config = getOMDBConfig();

  if (!config || !config.enabled || !config.api_key) {
    return { updated: 0, errors: 0 };
  }

  // Priority-based query - same logic as sync-worker.ts
  const shows = query.all<{ id: number; imdb_id: string; priority: number }>(
    `SELECT id, imdb_id,
      CASE
        -- Priority 1: Never fetched (no rating yet)
        WHEN imdb_rating IS NULL THEN 1
        -- Priority 2: Running or In Development shows
        WHEN status IN ('Running', 'In Development', 'To Be Determined') THEN 2
        -- Priority 3: Ended within 2 years
        WHEN status = 'Ended' AND ended IS NOT NULL AND ended >= date('now', '-2 years') THEN 3
        -- Priority 4: Ended 2-5 years ago
        WHEN status = 'Ended' AND ended IS NOT NULL AND ended >= date('now', '-5 years') THEN 4
        -- Priority 5: Everything else (ended 5+ years or unknown)
        ELSE 5
      END as priority
    FROM shows
    WHERE imdb_id IS NOT NULL
      AND imdb_id != ''
    ORDER BY
      priority ASC,
      imdb_rating_updated_at ASC NULLS FIRST
    LIMIT ?`,
    [limit]
  );

  let updated = 0;
  let errors = 0;

  for (const show of shows) {
    const rating = await fetchIMDBRating(show.imdb_id, config.api_key);

    if (rating !== null) {
      query.run(
        `UPDATE shows SET imdb_rating = ?, imdb_rating_updated_at = datetime('now') WHERE id = ?`,
        [rating, show.id]
      );
      updated++;
    } else {
      // Still update timestamp to avoid immediate retry
      query.run(`UPDATE shows SET imdb_rating_updated_at = datetime('now') WHERE id = ?`, [
        show.id
      ]);
      errors++;
    }

    // Rate limiting: OMDB free tier allows 1000 requests/day
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return { updated, errors };
}
