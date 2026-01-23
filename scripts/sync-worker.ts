/**
 * TVMaze Sync Worker
 *
 * Usage:
 *   npm run sync           # Run incremental sync (or full if never synced)
 *   npm run sync:full      # Force full sync
 *
 * This script can be run via cron for daily updates:
 *   0 4 * * * cd /path/to/fluxarr && npm run sync
 */

import Database from 'better-sqlite3';
import { readFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Configuration
const DB_PATH = process.env.DATABASE_PATH || './data/fluxarr.db';
const BASE_URL = 'https://api.tvmaze.com';

// Ensure data directory exists
const dataDir = dirname(DB_PATH);
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

// Database setup
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

// Run migrations
function migrate(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(
    db
      .prepare('SELECT version FROM schema_migrations')
      .all()
      .map((row) => (row as { version: number }).version)
  );

  const migrationsDir = join(__dirname, '../src/lib/server/migrations');
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const version = parseInt(file.split('_')[0], 10);
    if (applied.has(version)) continue;

    console.log(`Applying migration ${file}...`);
    const sql = readFileSync(join(migrationsDir, file), 'utf-8');

    db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(version);
    })();

    console.log(`Migration ${file} applied.`);
  }
}

// Rate limiting
const RATE_LIMIT_CALLS = 20;
const RATE_LIMIT_WINDOW = 10000;
const timestamps: number[] = [];

async function rateLimit(): Promise<void> {
  const now = Date.now();
  while (timestamps.length > 0 && now - timestamps[0] >= RATE_LIMIT_WINDOW) {
    timestamps.shift();
  }

  if (timestamps.length >= RATE_LIMIT_CALLS) {
    const waitTime = RATE_LIMIT_WINDOW - (now - timestamps[0]) + 100;
    console.log(`Rate limit reached, waiting ${waitTime}ms...`);
    await new Promise((resolve) => setTimeout(resolve, waitTime));
    return rateLimit();
  }

  timestamps.push(now);
}

async function fetchTVMaze<T>(endpoint: string): Promise<T | null> {
  await rateLimit();

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    if (response.status === 429) {
      console.log('Rate limited by API, waiting 5s...');
      await new Promise((resolve) => setTimeout(resolve, 5000));
      return fetchTVMaze(endpoint);
    }
    throw new Error(`TVMaze API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// TVMaze types (simplified for worker)
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

// Upsert show into database
const upsertShow = db.prepare(`
  INSERT INTO shows (
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
    synced_at = datetime('now')
`);

function saveShow(show: TVMazeShow): void {
  upsertShow.run(
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
  );
}

// Update sync status
function updateSyncStatus(
  field: 'last_full_sync' | 'last_incremental_sync',
  totalShows?: number
): void {
  if (totalShows !== undefined) {
    db.prepare(
      `UPDATE sync_status SET ${field} = datetime('now'), total_shows = ? WHERE id = 1`
    ).run(totalShows);
  } else {
    db.prepare(`UPDATE sync_status SET ${field} = datetime('now') WHERE id = 1`).run();
  }
}

// OMDB/IMDB rating functions
interface OMDBConfig {
  api_key: string;
  enabled: number;
}

interface OMDBResponse {
  Response: 'True' | 'False';
  Error?: string;
  imdbRating?: string;
}

function getOMDBConfig(): OMDBConfig | null {
  return db
    .prepare('SELECT api_key, enabled FROM omdb_config WHERE id = 1')
    .get() as OMDBConfig | null;
}

async function fetchIMDBRating(imdbId: string, apiKey: string): Promise<number | null> {
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
 * Always uses up to the daily limit (1000 requests). Priority determines ORDER:
 * 1. Shows with no rating yet (never fetched)
 * 2. Running/In Development shows (sorted by staleness)
 * 3. Recently ended shows within 2 years (sorted by staleness)
 * 4. Older ended shows 2-5 years (sorted by staleness)
 * 5. Very old shows 5+ years (sorted by staleness, lowest priority)
 *
 * Within each priority, shows are sorted by how long since last update.
 */
async function syncIMDBRatings(
  batchSize: number = 100
): Promise<{ updated: number; errors: number }> {
  const config = getOMDBConfig();

  if (!config || !config.enabled || !config.api_key) {
    console.log('OMDB not configured or disabled, skipping IMDB ratings sync');
    return { updated: 0, errors: 0 };
  }

  console.log('Starting smart IMDB ratings sync...');
  setSyncing(true, { current: 0, total: 0, phase: 'imdb' });

  // Priority-based query - always fill the batch, priority determines order
  // Priority 1: Never fetched (most important)
  // Priority 2: Running/In Development (ratings actively changing)
  // Priority 3: Recently ended <2 years (ratings still settling)
  // Priority 4: Ended 2-5 years ago (ratings mostly stable)
  // Priority 5: Ended 5+ years ago (lowest priority but still updated eventually)
  const shows = db
    .prepare(
      `
    SELECT id, imdb_id, name, status, ended, imdb_rating, imdb_rating_updated_at,
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
    LIMIT ?
  `
    )
    .all(batchSize) as {
    id: number;
    imdb_id: string;
    name: string;
    status: string;
    priority: number;
  }[];

  if (shows.length === 0) {
    console.log('No shows with IMDB IDs found');
    return { updated: 0, errors: 0 };
  }

  // Log priority breakdown
  const priorityCounts = shows.reduce(
    (acc, s) => {
      acc[s.priority] = (acc[s.priority] || 0) + 1;
      return acc;
    },
    {} as Record<number, number>
  );
  console.log(`Fetching IMDB ratings for ${shows.length} shows (sorted by priority):`);
  console.log(`  - New (never fetched): ${priorityCounts[1] || 0}`);
  console.log(`  - Running/In Development: ${priorityCounts[2] || 0}`);
  console.log(`  - Recently ended (<2 years): ${priorityCounts[3] || 0}`);
  console.log(`  - Older ended (2-5 years): ${priorityCounts[4] || 0}`);
  console.log(`  - Very old (5+ years): ${priorityCounts[5] || 0}`);

  let updated = 0;
  let errors = 0;

  const updateStmt = db.prepare(
    "UPDATE shows SET imdb_rating = ?, imdb_rating_updated_at = datetime('now') WHERE id = ?"
  );

  for (let i = 0; i < shows.length; i++) {
    const show = shows[i];
    const rating = await fetchIMDBRating(show.imdb_id, config.api_key);

    if (rating !== null) {
      updateStmt.run(rating, show.id);
      updated++;
    } else {
      // Still update the timestamp even on error/N/A to avoid retrying immediately
      db.prepare("UPDATE shows SET imdb_rating_updated_at = datetime('now') WHERE id = ?").run(
        show.id
      );
      errors++;
    }

    if ((i + 1) % 10 === 0) {
      console.log(`IMDB progress: ${i + 1}/${shows.length} (${updated} updated, ${errors} errors)`);
      setSyncing(true, { current: i + 1, total: shows.length, phase: 'imdb' });
    }

    // Rate limiting: OMDB free tier is 1000/day, add 100ms delay
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log(`IMDB ratings sync complete. Updated: ${updated}, Errors: ${errors}`);
  return { updated, errors };
}

function setSyncing(
  syncing: boolean,
  progress?: { current: number; total: number; phase: string }
): void {
  db.prepare('UPDATE sync_status SET is_syncing = ?, sync_progress = ? WHERE id = 1').run(
    syncing ? 1 : 0,
    progress ? JSON.stringify(progress) : null
  );
}

// Full sync - paginate through all shows
async function fullSync(): Promise<void> {
  console.log('Starting full sync...');
  setSyncing(true, { current: 0, total: 0, phase: 'full' });

  let page = 0;
  let totalShows = 0;

  while (true) {
    const shows = await fetchTVMaze<TVMazeShow[]>(`/shows?page=${page}`);
    if (!shows || shows.length === 0) break;

    db.transaction(() => {
      for (const show of shows) {
        saveShow(show);
      }
    })();

    totalShows += shows.length;
    console.log(`Page ${page}: ${shows.length} shows (total: ${totalShows})`);

    setSyncing(true, { current: totalShows, total: totalShows, phase: 'full' });
    page++;
  }

  updateSyncStatus('last_full_sync', totalShows);
  setSyncing(false);
  console.log(`Full sync complete. Total shows: ${totalShows}`);
}

// Incremental sync - only fetch updated shows
async function incrementalSync(): Promise<void> {
  console.log('Starting incremental sync...');
  setSyncing(true, { current: 0, total: 0, phase: 'incremental' });

  // Get updates from last day
  const updates = await fetchTVMaze<Record<string, number>>('/updates/shows?since=day');
  if (!updates) {
    console.log('No updates received');
    setSyncing(false);
    return;
  }

  const showIds = Object.keys(updates).map(Number);
  console.log(`${showIds.length} shows to update`);

  let processed = 0;
  for (const id of showIds) {
    const show = await fetchTVMaze<TVMazeShow>(`/shows/${id}`);
    if (show) {
      saveShow(show);
    }
    processed++;

    if (processed % 50 === 0) {
      console.log(`Progress: ${processed}/${showIds.length}`);
      setSyncing(true, { current: processed, total: showIds.length, phase: 'incremental' });
    }
  }

  // Get current total
  const totalShows = db.prepare('SELECT COUNT(*) as count FROM shows').get() as { count: number };

  updateSyncStatus('last_incremental_sync', totalShows.count);
  setSyncing(false);
  console.log(`Incremental sync complete. Updated ${processed} shows. Total: ${totalShows.count}`);
}

// Main
async function main(): Promise<void> {
  const forceFullSync = process.argv.includes('--full');
  const imdbOnly = process.argv.includes('--imdb');

  try {
    // Run migrations first
    migrate();

    // Check if we've ever done a full sync
    const status = db.prepare('SELECT * FROM sync_status WHERE id = 1').get() as {
      last_full_sync: string | null;
      is_syncing: number;
    };

    if (status?.is_syncing) {
      console.log('Another sync is already in progress. Exiting.');
      process.exit(1);
    }

    if (imdbOnly) {
      // Only sync IMDB ratings
      await syncIMDBRatings(500);
    } else {
      // TVMaze sync
      if (forceFullSync || !status?.last_full_sync) {
        await fullSync();
      } else {
        await incrementalSync();
      }

      // Sync IMDB ratings after TVMaze sync (100 per run to stay within rate limits)
      await syncIMDBRatings(100);
    }
  } catch (error) {
    console.error('Sync failed:', error);
    setSyncing(false);
    process.exit(1);
  } finally {
    setSyncing(false);
    db.close();
  }
}

main();
