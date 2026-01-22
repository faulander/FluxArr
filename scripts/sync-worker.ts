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
    db.prepare(`UPDATE sync_status SET ${field} = datetime('now'), total_shows = ? WHERE id = 1`).run(
      totalShows
    );
  } else {
    db.prepare(`UPDATE sync_status SET ${field} = datetime('now') WHERE id = 1`).run();
  }
}

function setSyncing(syncing: boolean, progress?: { current: number; total: number; phase: string }): void {
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

    if (forceFullSync || !status?.last_full_sync) {
      await fullSync();
    } else {
      await incrementalSync();
    }
  } catch (error) {
    console.error('Sync failed:', error);
    setSyncing(false);
    process.exit(1);
  } finally {
    db.close();
  }
}

main();
