// OMDB API client for fetching IMDB ratings
// API documentation: https://www.omdbapi.com/

import { query } from './db';
import { logger } from './logger';

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
  premium: number;
  created_at: string;
  updated_at: string;
}

// Daily request limits per plan
const OMDB_FREE_DAILY_LIMIT = 100;
const OMDB_PREMIUM_DAILY_LIMIT = 100_000;

export function getOMDBConfig(): OMDBConfig | null {
  return query.get<OMDBConfig>(`SELECT * FROM omdb_config WHERE id = 1`) || null;
}

export function saveOMDBConfig(apiKey: string, enabled: boolean, premium: boolean = false): void {
  const existing = getOMDBConfig();

  if (existing) {
    query.run(
      `UPDATE omdb_config SET api_key = ?, enabled = ?, premium = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1`,
      [apiKey, enabled ? 1 : 0, premium ? 1 : 0]
    );
  } else {
    query.run(`INSERT INTO omdb_config (id, api_key, enabled, premium) VALUES (1, ?, ?, ?)`, [
      apiKey,
      enabled ? 1 : 0,
      premium ? 1 : 0
    ]);
  }
}

export function getOMDBDailyLimit(): number {
  const config = getOMDBConfig();
  if (!config) return OMDB_FREE_DAILY_LIMIT;
  return config.premium ? OMDB_PREMIUM_DAILY_LIMIT : OMDB_FREE_DAILY_LIMIT;
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
 * Calculate the optimal batch size for a sync run based on the daily limit
 * and how many runs per day we expect (based on job interval).
 */
export function calculateBatchSize(intervalMinutes: number): number {
  const config = getOMDBConfig();
  if (!config) return 0;

  const dailyLimit = config.premium ? OMDB_PREMIUM_DAILY_LIMIT : OMDB_FREE_DAILY_LIMIT;
  const runsPerDay = Math.floor((24 * 60) / intervalMinutes);
  // Use 90% of budget to leave headroom for test calls etc.
  const batchSize = Math.floor((dailyLimit * 0.9) / Math.max(runsPerDay, 1));

  // Clamp: at least 10, at most 10k per run to keep memory reasonable
  return Math.max(10, Math.min(batchSize, 10_000));
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
): Promise<{ updated: number; errors: number; total: number }> {
  const config = getOMDBConfig();

  if (!config || !config.enabled || !config.api_key) {
    logger.omdb.info('OMDB not configured or disabled, skipping sync');
    return { updated: 0, errors: 0, total: 0 };
  }

  // Priority-based query
  const shows = query.all<{ id: number; imdb_id: string; name: string; priority: number }>(
    `SELECT id, imdb_id, name,
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

  if (shows.length === 0) {
    logger.omdb.info('No shows need IMDB rating updates');
    return { updated: 0, errors: 0, total: 0 };
  }

  // Log priority breakdown
  const priorityCounts = shows.reduce(
    (acc, s) => {
      acc[s.priority] = (acc[s.priority] || 0) + 1;
      return acc;
    },
    {} as Record<number, number>
  );

  logger.omdb.info(`Starting IMDB ratings sync for ${shows.length} shows`, {
    batch: shows.length,
    new: priorityCounts[1] || 0,
    running: priorityCounts[2] || 0,
    recentlyEnded: priorityCounts[3] || 0,
    olderEnded: priorityCounts[4] || 0,
    veryOld: priorityCounts[5] || 0
  });

  let updated = 0;
  let errors = 0;

  for (let i = 0; i < shows.length; i++) {
    const show = shows[i];
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

    // Log progress every 500 shows
    if ((i + 1) % 500 === 0) {
      logger.omdb.info(`Progress: ${i + 1}/${shows.length} (${updated} updated, ${errors} errors)`);
    }

    // Rate limiting: small delay to avoid hammering the API
    await new Promise((resolve) => setTimeout(resolve, config.premium ? 10 : 100));
  }

  logger.omdb.info(`IMDB ratings sync complete`, {
    updated,
    errors,
    total: shows.length
  });

  return { updated, errors, total: shows.length };
}
