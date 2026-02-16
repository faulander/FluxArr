import { query } from './db';
import { logger } from './logger';
import {
  getTMDBConfig,
  getGenreMap,
  fetchPopularMovies,
  fetchTopRatedMovies,
  discoverMovies,
  fetchMovieDetails,
  fetchMovieChanges,
  tmdbMovieToDbValues
} from './tmdb';
import type { TMDBMovie } from '$lib/types';

// Reset sync status on module load (in case of previous crash)
try {
  query.run(
    'UPDATE movie_sync_status SET is_syncing = 0, sync_progress = NULL WHERE id = 1 AND is_syncing = 1',
    []
  );
} catch {
  // Ignore errors during startup (table might not exist yet)
}

function setMovieSyncing(
  syncing: boolean,
  progress?: { current: number; total: number; phase: string }
): void {
  query.run('UPDATE movie_sync_status SET is_syncing = ?, sync_progress = ? WHERE id = 1', [
    syncing ? 1 : 0,
    progress ? JSON.stringify(progress) : null
  ]);
}

function updateMovieSyncStatus(
  field: 'last_full_sync' | 'last_incremental_sync',
  totalMovies?: number
): void {
  if (totalMovies !== undefined) {
    query.run(
      `UPDATE movie_sync_status SET ${field} = datetime('now'), total_movies = ? WHERE id = 1`,
      [totalMovies]
    );
  } else {
    query.run(`UPDATE movie_sync_status SET ${field} = datetime('now') WHERE id = 1`, []);
  }
}

export interface MovieSyncStatusInfo {
  lastFullSync: string | null;
  lastIncrementalSync: string | null;
  totalMovies: number;
  isSyncing: boolean;
  syncProgress: { current: number; total: number; phase: string } | null;
}

export function getMovieSyncStatus(): MovieSyncStatusInfo {
  const status = query.get<{
    last_full_sync: string | null;
    last_incremental_sync: string | null;
    total_movies: number;
    is_syncing: number;
    sync_progress: string | null;
  }>('SELECT * FROM movie_sync_status WHERE id = 1');

  return {
    lastFullSync: status?.last_full_sync || null,
    lastIncrementalSync: status?.last_incremental_sync || null,
    totalMovies: status?.total_movies || 0,
    isSyncing: status?.is_syncing === 1,
    syncProgress: status?.sync_progress ? JSON.parse(status.sync_progress) : null
  };
}

export function resetMovieSyncStatus(): void {
  query.run('UPDATE movie_sync_status SET is_syncing = 0, sync_progress = NULL WHERE id = 1', []);
  logger.tmdb.info('Movie sync status reset');
}

/**
 * Upsert a movie into the database from TMDB data.
 */
function saveMovie(values: Record<string, unknown>): void {
  query.run(
    `INSERT INTO movies (
      id, title, original_title, slug, language, genres, status, runtime,
      release_date, revenue, budget, vote_average, vote_count, popularity,
      imdb_id, poster_path, backdrop_path, overview, tagline,
      production_companies, production_countries, spoken_languages,
      updated_at, synced_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now')
    )
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      original_title = excluded.original_title,
      slug = excluded.slug,
      language = excluded.language,
      genres = excluded.genres,
      status = excluded.status,
      runtime = excluded.runtime,
      release_date = excluded.release_date,
      revenue = excluded.revenue,
      budget = excluded.budget,
      vote_average = excluded.vote_average,
      vote_count = excluded.vote_count,
      popularity = excluded.popularity,
      imdb_id = excluded.imdb_id,
      poster_path = excluded.poster_path,
      backdrop_path = excluded.backdrop_path,
      overview = excluded.overview,
      tagline = excluded.tagline,
      production_companies = excluded.production_companies,
      production_countries = excluded.production_countries,
      spoken_languages = excluded.spoken_languages,
      updated_at = excluded.updated_at,
      synced_at = datetime('now')`,
    [
      values.id,
      values.title,
      values.original_title,
      values.slug,
      values.language,
      values.genres,
      values.status,
      values.runtime,
      values.release_date,
      values.revenue,
      values.budget,
      values.vote_average,
      values.vote_count,
      values.popularity,
      values.imdb_id,
      values.poster_path,
      values.backdrop_path,
      values.overview,
      values.tagline,
      values.production_companies,
      values.production_countries,
      values.spoken_languages,
      values.updated_at
    ]
  );
}

/**
 * Save a batch of movies from a list endpoint (uses genre_ids, not full details).
 */
function saveMovieBatch(movies: TMDBMovie[], genreMapRef: Map<number, string>): number {
  let saved = 0;
  query.transaction(() => {
    for (const movie of movies) {
      if (!movie.title) continue;
      const values = tmdbMovieToDbValues(movie, genreMapRef);
      saveMovie(values);
      saved++;
    }
  });
  return saved;
}

/**
 * Seed the movies database from TMDB popular/top_rated/discover endpoints.
 * Targets ~20,000-50,000 movies on first run.
 */
export async function runMovieFullSync(): Promise<{ updated: number; total: number }> {
  const config = getTMDBConfig();
  if (!config || !config.enabled || !config.api_key) {
    logger.tmdb.info('TMDB not configured or disabled, skipping sync');
    return { updated: 0, total: 0 };
  }

  let status = getMovieSyncStatus();
  if (status.isSyncing) {
    logger.tmdb.warn('Movie sync status was stuck, resetting');
    resetMovieSyncStatus();
    status = getMovieSyncStatus();
  }

  logger.tmdb.info('Starting full movie sync (seed)');
  setMovieSyncing(true, { current: 0, total: 0, phase: 'seed' });

  const apiKey = config.api_key;
  let totalSaved = 0;

  try {
    // Load genre mapping
    const gMap = await getGenreMap(apiKey);

    // 1. Popular movies (up to 500 pages = 10,000 movies)
    const popularPages = 200;
    logger.tmdb.info(`Fetching popular movies (up to ${popularPages} pages)`);
    for (let page = 1; page <= popularPages; page++) {
      const result = await fetchPopularMovies(apiKey, page);
      if (!result || result.results.length === 0) break;
      if (page > result.total_pages) break;

      totalSaved += saveMovieBatch(result.results, gMap);
      if (page % 50 === 0) {
        logger.tmdb.info(`Popular: page ${page}, ${totalSaved} movies saved`);
        setMovieSyncing(true, { current: totalSaved, total: totalSaved, phase: 'seed-popular' });
      }
    }
    logger.tmdb.info(`Popular movies done: ${totalSaved} total`);

    // 2. Top-rated movies (up to 200 pages = 4,000 movies)
    const topRatedPages = 200;
    logger.tmdb.info(`Fetching top-rated movies (up to ${topRatedPages} pages)`);
    for (let page = 1; page <= topRatedPages; page++) {
      const result = await fetchTopRatedMovies(apiKey, page);
      if (!result || result.results.length === 0) break;
      if (page > result.total_pages) break;

      totalSaved += saveMovieBatch(result.results, gMap);
      if (page % 50 === 0) {
        logger.tmdb.info(`Top-rated: page ${page}, ${totalSaved} movies saved`);
        setMovieSyncing(true, { current: totalSaved, total: totalSaved, phase: 'seed-top-rated' });
      }
    }
    logger.tmdb.info(`Top-rated movies done: ${totalSaved} total`);

    // 3. Discover by decade (for breadth)
    const decades = ['2020', '2010', '2000', '1990', '1980'];
    const discoverPagesPerDecade = 100;
    for (const decade of decades) {
      const yearGte = decade;
      const yearLte = String(parseInt(decade) + 9);
      logger.tmdb.info(`Fetching discover movies ${yearGte}-${yearLte}`);

      for (let page = 1; page <= discoverPagesPerDecade; page++) {
        const result = await discoverMovies(apiKey, page, {
          'primary_release_date.gte': `${yearGte}-01-01`,
          'primary_release_date.lte': `${yearLte}-12-31`
        });
        if (!result || result.results.length === 0) break;
        if (page > result.total_pages) break;

        totalSaved += saveMovieBatch(result.results, gMap);
      }
      logger.tmdb.info(`Discover ${yearGte}-${yearLte} done: ${totalSaved} total`);
      setMovieSyncing(true, { current: totalSaved, total: totalSaved, phase: `seed-discover-${decade}s` });
    }

    // Count actual movies in DB
    const countResult = query.get<{ count: number }>('SELECT COUNT(*) as count FROM movies');
    const dbTotal = countResult?.count || 0;

    updateMovieSyncStatus('last_full_sync', dbTotal);
    logger.tmdb.info(`Full movie sync complete: ${totalSaved} upserts, ${dbTotal} unique movies in DB`);

    return { updated: totalSaved, total: dbTotal };
  } finally {
    setMovieSyncing(false);
  }
}

/**
 * Incremental sync - fetches movies that changed in the last 24 hours via /movie/changes.
 * For changed movies that exist in our DB, re-fetch full details.
 */
export async function runMovieIncrementalSync(): Promise<{ updated: number; total: number }> {
  const config = getTMDBConfig();
  if (!config || !config.enabled || !config.api_key) {
    logger.tmdb.info('TMDB not configured or disabled, skipping sync');
    return { updated: 0, total: 0 };
  }

  let status = getMovieSyncStatus();

  if (status.isSyncing) {
    logger.tmdb.warn('Movie sync status was stuck, resetting');
    resetMovieSyncStatus();
    status = getMovieSyncStatus();
  }

  // If never done a full sync, run that first
  if (!status.lastFullSync) {
    logger.tmdb.info('No full movie sync found, running seed first');
    return runMovieFullSync();
  }

  logger.tmdb.info('Starting incremental movie sync');
  setMovieSyncing(true, { current: 0, total: 0, phase: 'incremental' });

  const apiKey = config.api_key;

  try {
    // Fetch changes from last 24 hours
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Collect all changed IDs
    const changedIds: number[] = [];
    let page = 1;
    while (true) {
      const changes = await fetchMovieChanges(apiKey, startDate, endDate, page);
      if (!changes || changes.results.length === 0) break;

      for (const item of changes.results) {
        if (!item.adult) {
          changedIds.push(item.id);
        }
      }

      if (page >= changes.total_pages) break;
      page++;
    }

    if (changedIds.length === 0) {
      logger.tmdb.info('No movie changes found');
      setMovieSyncing(false);
      return { updated: 0, total: status.totalMovies };
    }

    // Only update movies that already exist in our DB
    const existingIds = new Set(
      query
        .all<{ id: number }>('SELECT id FROM movies')
        .map((r) => r.id)
    );

    const toUpdate = changedIds.filter((id) => existingIds.has(id));
    logger.tmdb.info(`${changedIds.length} changed movies, ${toUpdate.length} exist in our DB`);

    let updated = 0;
    for (let i = 0; i < toUpdate.length; i++) {
      const movie = await fetchMovieDetails(toUpdate[i], apiKey);
      if (movie) {
        const values = tmdbMovieToDbValues(movie);
        saveMovie(values);
        updated++;
      }

      if ((i + 1) % 100 === 0) {
        logger.tmdb.info(`Incremental progress: ${i + 1}/${toUpdate.length}`);
        setMovieSyncing(true, { current: i + 1, total: toUpdate.length, phase: 'incremental' });
      }
    }

    const countResult = query.get<{ count: number }>('SELECT COUNT(*) as count FROM movies');
    const dbTotal = countResult?.count || 0;

    updateMovieSyncStatus('last_incremental_sync', dbTotal);
    logger.tmdb.info(`Incremental movie sync complete: updated ${updated} movies, ${dbTotal} total`);

    return { updated, total: dbTotal };
  } finally {
    setMovieSyncing(false);
  }
}
