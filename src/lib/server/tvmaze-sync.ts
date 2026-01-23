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

interface TVMazePerson {
  id: number;
  name: string;
  birthday: string | null;
  deathday: string | null;
  gender: string | null;
  country: { name: string; code: string } | null;
  image: { medium: string; original: string } | null;
  updated: number;
}

interface TVMazeCastMember {
  person: TVMazePerson;
  character: {
    id: number;
    name: string;
    image: { medium: string; original: string } | null;
  };
  self: boolean;
  voice: boolean;
}

interface TVMazeCrewMember {
  type: string;
  person: TVMazePerson;
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

function savePerson(person: TVMazePerson): void {
  query.run(
    `INSERT INTO people (id, name, birthday, deathday, gender, country_name, country_code, image_medium, image_original, updated_at, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       birthday = excluded.birthday,
       deathday = excluded.deathday,
       gender = excluded.gender,
       country_name = excluded.country_name,
       country_code = excluded.country_code,
       image_medium = excluded.image_medium,
       image_original = excluded.image_original,
       updated_at = excluded.updated_at,
       synced_at = datetime('now')`,
    [
      person.id,
      person.name,
      person.birthday,
      person.deathday,
      person.gender,
      person.country?.name || null,
      person.country?.code || null,
      person.image?.medium || null,
      person.image?.original || null,
      person.updated
    ]
  );
}

function saveCastMember(showId: number, cast: TVMazeCastMember, sortOrder: number): void {
  savePerson(cast.person);
  query.run(
    `INSERT INTO show_cast (show_id, person_id, character_name, character_image_medium, character_image_original, is_self, is_voice, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(show_id, person_id, character_name) DO UPDATE SET
       character_image_medium = excluded.character_image_medium,
       character_image_original = excluded.character_image_original,
       is_self = excluded.is_self,
       is_voice = excluded.is_voice,
       sort_order = excluded.sort_order`,
    [
      showId,
      cast.person.id,
      cast.character.name,
      cast.character.image?.medium || null,
      cast.character.image?.original || null,
      cast.self ? 1 : 0,
      cast.voice ? 1 : 0,
      sortOrder
    ]
  );
}

function saveCrewMember(showId: number, crew: TVMazeCrewMember): void {
  savePerson(crew.person);
  query.run(
    `INSERT INTO show_crew (show_id, person_id, crew_type)
     VALUES (?, ?, ?)
     ON CONFLICT(show_id, person_id, crew_type) DO NOTHING`,
    [showId, crew.person.id, crew.type]
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
 * Fetch and save cast/crew for a specific show (on-demand)
 */
export async function fetchShowCastCrew(showId: number): Promise<{
  cast: Array<{
    personId: number;
    personName: string;
    personImage: string | null;
    characterName: string;
    characterImage: string | null;
    isSelf: boolean;
    isVoice: boolean;
  }>;
  crew: Array<{
    personId: number;
    personName: string;
    personImage: string | null;
    crewType: string;
  }>;
}> {
  // Check if we already have cast/crew data
  const existingCast = query.get<{ count: number }>(
    'SELECT COUNT(*) as count FROM show_cast WHERE show_id = ?',
    [showId]
  );

  if (existingCast && existingCast.count > 0) {
    // Return cached data
    return getCachedCastCrew(showId);
  }

  // Fetch from TVMaze
  logger.tvmaze.debug(`Fetching cast/crew for show ${showId}`);

  try {
    const [castData, crewData] = await Promise.all([
      fetchTVMaze<TVMazeCastMember[]>(`/shows/${showId}/cast`),
      fetchTVMaze<TVMazeCrewMember[]>(`/shows/${showId}/crew`)
    ]);

    // Save cast
    if (castData) {
      query.transaction(() => {
        castData.forEach((member, index) => {
          saveCastMember(showId, member, index);
        });
      });
    }

    // Save crew
    if (crewData) {
      query.transaction(() => {
        crewData.forEach((member) => {
          saveCrewMember(showId, member);
        });
      });
    }

    return getCachedCastCrew(showId);
  } catch (error) {
    logger.tvmaze.error(`Failed to fetch cast/crew for show ${showId}: ${error}`);
    return { cast: [], crew: [] };
  }
}

function getCachedCastCrew(showId: number): {
  cast: Array<{
    personId: number;
    personName: string;
    personImage: string | null;
    characterName: string;
    characterImage: string | null;
    isSelf: boolean;
    isVoice: boolean;
  }>;
  crew: Array<{
    personId: number;
    personName: string;
    personImage: string | null;
    crewType: string;
  }>;
} {
  const cast = query.all<{
    person_id: number;
    person_name: string;
    person_image: string | null;
    character_name: string;
    character_image: string | null;
    is_self: number;
    is_voice: number;
  }>(
    `SELECT
       sc.person_id, p.name as person_name, p.image_medium as person_image,
       sc.character_name, sc.character_image_medium as character_image,
       sc.is_self, sc.is_voice
     FROM show_cast sc
     JOIN people p ON sc.person_id = p.id
     WHERE sc.show_id = ?
     ORDER BY sc.sort_order`,
    [showId]
  );

  const crew = query.all<{
    person_id: number;
    person_name: string;
    person_image: string | null;
    crew_type: string;
  }>(
    `SELECT
       scr.person_id, p.name as person_name, p.image_medium as person_image,
       scr.crew_type
     FROM show_crew scr
     JOIN people p ON scr.person_id = p.id
     WHERE scr.show_id = ?
     ORDER BY
       CASE scr.crew_type
         WHEN 'Creator' THEN 1
         WHEN 'Executive Producer' THEN 2
         WHEN 'Co-Executive Producer' THEN 3
         WHEN 'Supervising Producer' THEN 4
         WHEN 'Producer' THEN 5
         ELSE 6
       END`,
    [showId]
  );

  return {
    cast: cast.map((c) => ({
      personId: c.person_id,
      personName: c.person_name,
      personImage: c.person_image,
      characterName: c.character_name,
      characterImage: c.character_image,
      isSelf: c.is_self === 1,
      isVoice: c.is_voice === 1
    })),
    crew: crew.map((c) => ({
      personId: c.person_id,
      personName: c.person_name,
      personImage: c.person_image,
      crewType: c.crew_type
    }))
  };
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
