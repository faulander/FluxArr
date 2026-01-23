import { query } from './db';
import { logger } from './logger';

const BASE_URL = 'https://api.tvmaze.com';

// Reset sync status on module load (in case of previous crash)
try {
  query.run(
    'UPDATE sync_status SET is_syncing = 0, sync_progress = NULL WHERE id = 1 AND is_syncing = 1',
    []
  );
} catch {
  // Ignore errors during startup (table might not exist yet)
}

// Rate limiting - 20 calls per 10 seconds
const RATE_LIMIT_CALLS = 20;
const RATE_LIMIT_WINDOW = 10000;
let callCount = 0;
let windowStart = Date.now();

async function rateLimit(): Promise<void> {
  const now = Date.now();

  // Reset window if enough time has passed
  if (now - windowStart >= RATE_LIMIT_WINDOW) {
    callCount = 0;
    windowStart = now;
  }

  // If we've hit the limit, wait for the full window to reset
  if (callCount >= RATE_LIMIT_CALLS) {
    const waitTime = RATE_LIMIT_WINDOW - (now - windowStart) + 500;
    logger.tvmaze.debug(`Rate limit reached, waiting ${Math.round(waitTime / 1000)}s`);
    await new Promise((resolve) => setTimeout(resolve, waitTime));
    callCount = 0;
    windowStart = Date.now();
  }

  callCount++;
}

async function fetchTVMaze<T>(endpoint: string): Promise<T | null> {
  await rateLimit();

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    if (response.status === 429) {
      logger.tvmaze.warn('Rate limited by API, waiting 5s');
      await new Promise((resolve) => setTimeout(resolve, 5000));
      return fetchTVMaze(endpoint);
    }
    throw new Error(`TVMaze API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

interface TVMazeShow {
  id: number;
  url: string;
  name: string;
  type: string;
  language: string | null;
  genres: string[];
  status: string;
  runtime: number | null;
  averageRuntime: number | null;
  premiered: string | null;
  ended: string | null;
  officialSite: string | null;
  schedule: { time: string; days: string[] };
  rating: { average: number | null };
  weight: number;
  network: {
    id: number;
    name: string;
    country: { name: string; code: string } | null;
  } | null;
  webChannel: {
    id: number;
    name: string;
    country: { name: string; code: string } | null;
  } | null;
  externals: { tvrage: number | null; thetvdb: number | null; imdb: string | null };
  image: { medium: string; original: string } | null;
  summary: string | null;
  updated: number;
}

function saveShow(show: TVMazeShow): void {
  query.run(
    `INSERT INTO shows (
      id, name, slug, type, language, genres, status, runtime, average_runtime,
      premiered, ended, official_site, schedule_time, schedule_days, rating_average,
      weight, network_id, network_name, network_country_name, network_country_code,
      web_channel_id, web_channel_name, web_channel_country_code, image_medium,
      image_original, summary, imdb_id, thetvdb_id, tvrage_id, updated_at, synced_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now')
    )
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      slug = excluded.slug,
      type = excluded.type,
      language = excluded.language,
      genres = excluded.genres,
      status = excluded.status,
      runtime = excluded.runtime,
      average_runtime = excluded.average_runtime,
      premiered = excluded.premiered,
      ended = excluded.ended,
      official_site = excluded.official_site,
      schedule_time = excluded.schedule_time,
      schedule_days = excluded.schedule_days,
      rating_average = excluded.rating_average,
      weight = excluded.weight,
      network_id = excluded.network_id,
      network_name = excluded.network_name,
      network_country_name = excluded.network_country_name,
      network_country_code = excluded.network_country_code,
      web_channel_id = excluded.web_channel_id,
      web_channel_name = excluded.web_channel_name,
      web_channel_country_code = excluded.web_channel_country_code,
      image_medium = excluded.image_medium,
      image_original = excluded.image_original,
      summary = excluded.summary,
      imdb_id = excluded.imdb_id,
      thetvdb_id = excluded.thetvdb_id,
      tvrage_id = excluded.tvrage_id,
      updated_at = excluded.updated_at,
      synced_at = datetime('now')`,
    [
      show.id,
      show.name,
      show.url.split('/').pop() || null,
      show.type,
      show.language,
      JSON.stringify(show.genres),
      show.status,
      show.runtime,
      show.averageRuntime,
      show.premiered,
      show.ended,
      show.officialSite,
      show.schedule.time || null,
      JSON.stringify(show.schedule.days),
      show.rating.average,
      show.weight,
      show.network?.id || null,
      show.network?.name || null,
      show.network?.country?.name || null,
      show.network?.country?.code || null,
      show.webChannel?.id || null,
      show.webChannel?.name || null,
      show.webChannel?.country?.code || null,
      show.image?.medium || null,
      show.image?.original || null,
      show.summary,
      show.externals.imdb,
      show.externals.thetvdb,
      show.externals.tvrage,
      show.updated
    ]
  );
}

function setSyncing(
  syncing: boolean,
  progress?: { current: number; total: number; phase: string }
): void {
  query.run('UPDATE sync_status SET is_syncing = ?, sync_progress = ? WHERE id = 1', [
    syncing ? 1 : 0,
    progress ? JSON.stringify(progress) : null
  ]);
}

function updateSyncStatus(
  field: 'last_full_sync' | 'last_incremental_sync',
  totalShows?: number
): void {
  if (totalShows !== undefined) {
    query.run(`UPDATE sync_status SET ${field} = datetime('now'), total_shows = ? WHERE id = 1`, [
      totalShows
    ]);
  } else {
    query.run(`UPDATE sync_status SET ${field} = datetime('now') WHERE id = 1`, []);
  }
}

export interface SyncStatus {
  lastFullSync: string | null;
  lastIncrementalSync: string | null;
  totalShows: number;
  isSyncing: boolean;
  syncProgress: { current: number; total: number; phase: string } | null;
}

export function getSyncStatus(): SyncStatus {
  const status = query.get<{
    last_full_sync: string | null;
    last_incremental_sync: string | null;
    total_shows: number;
    is_syncing: number;
    sync_progress: string | null;
  }>('SELECT * FROM sync_status WHERE id = 1');

  return {
    lastFullSync: status?.last_full_sync || null,
    lastIncrementalSync: status?.last_incremental_sync || null,
    totalShows: status?.total_shows || 0,
    isSyncing: status?.is_syncing === 1,
    syncProgress: status?.sync_progress ? JSON.parse(status.sync_progress) : null
  };
}

/**
 * Force reset the sync status (use if stuck)
 */
export function resetSyncStatus(): void {
  query.run('UPDATE sync_status SET is_syncing = 0, sync_progress = NULL WHERE id = 1', []);
  logger.tvmaze.info('Sync status reset');
}

/**
 * Incremental sync - fetches only shows updated in the last day
 */
export async function runIncrementalSync(): Promise<{ updated: number; total: number }> {
  let status = getSyncStatus();

  // If sync claims to be running, reset it (single-process app, so it must be stuck)
  if (status.isSyncing) {
    logger.tvmaze.warn('Sync status was stuck, resetting');
    resetSyncStatus();
    status = getSyncStatus();
  }

  // If we've never done a full sync, we need to do that first
  if (!status.lastFullSync) {
    logger.tvmaze.info('No full sync found, running full sync first');
    return runFullSync();
  }

  logger.tvmaze.info('Starting incremental sync');
  setSyncing(true, { current: 0, total: 0, phase: 'incremental' });

  try {
    // Get updates from last day
    const updates = await fetchTVMaze<Record<string, number>>('/updates/shows?since=day');
    if (!updates) {
      logger.tvmaze.info('No updates received');
      setSyncing(false);
      return { updated: 0, total: status.totalShows };
    }

    const showIds = Object.keys(updates).map(Number);
    logger.tvmaze.info(`${showIds.length} shows to update`);

    let processed = 0;
    for (const id of showIds) {
      const show = await fetchTVMaze<TVMazeShow>(`/shows/${id}`);
      if (show) {
        saveShow(show);
      }
      processed++;

      if (processed % 50 === 0) {
        logger.tvmaze.debug(`Progress: ${processed}/${showIds.length}`);
        setSyncing(true, { current: processed, total: showIds.length, phase: 'incremental' });
      }
    }

    // Get current total
    const totalShows = query.get<{ count: number }>('SELECT COUNT(*) as count FROM shows');
    const total = totalShows?.count || 0;

    updateSyncStatus('last_incremental_sync', total);
    logger.tvmaze.info(`Incremental sync complete: updated ${processed} shows, total ${total}`);

    return { updated: processed, total };
  } finally {
    setSyncing(false);
  }
}

/**
 * Full sync - fetches all shows from TVMaze (use sparingly)
 */
export async function runFullSync(): Promise<{ updated: number; total: number }> {
  let status = getSyncStatus();

  // If sync claims to be running, reset it (single-process app, so it must be stuck)
  if (status.isSyncing) {
    logger.tvmaze.warn('Sync status was stuck, resetting');
    resetSyncStatus();
    status = getSyncStatus();
  }

  logger.tvmaze.info('Starting full sync');
  setSyncing(true, { current: 0, total: 0, phase: 'full' });

  try {
    let page = 0;
    let totalShows = 0;

    while (true) {
      const shows = await fetchTVMaze<TVMazeShow[]>(`/shows?page=${page}`);
      if (!shows || shows.length === 0) break;

      query.transaction(() => {
        for (const show of shows) {
          saveShow(show);
        }
      });

      totalShows += shows.length;
      logger.tvmaze.debug(`Page ${page}: ${shows.length} shows (total: ${totalShows})`);

      setSyncing(true, { current: totalShows, total: totalShows, phase: 'full' });
      page++;
    }

    updateSyncStatus('last_full_sync', totalShows);
    logger.tvmaze.info(`Full sync complete: ${totalShows} shows`);

    return { updated: totalShows, total: totalShows };
  } finally {
    setSyncing(false);
  }
}
