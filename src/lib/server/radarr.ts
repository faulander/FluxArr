import { query } from './db';
import { logger } from './logger';

// Radarr library cache entry
export interface RadarrLibraryEntry {
  id: number;
  config_id: number;
  radarr_id: number;
  tmdb_id: number | null;
  title: string | null;
  status: string | null;
  monitored: number;
  has_file: number;
  size_on_disk: number;
  path: string | null;
  synced_at: string;
}

export interface RadarrConfig {
  id: number;
  user_id: number | null;
  name: string;
  url: string;
  api_key: string;
  is_default: number;
  last_library_sync: string | null;
  created_at: string;
}

export interface RadarrQualityProfile {
  id: number;
  name: string;
}

export interface RadarrRootFolder {
  id: number;
  path: string;
  freeSpace: number;
}

export interface RadarrMovie {
  id: number;
  title: string;
  tmdbId: number;
  imdbId: string | null;
  monitored: boolean;
  status: string;
  hasFile: boolean;
  path?: string;
  sizeOnDisk?: number;
  movieFile?: {
    size: number;
  };
}

export interface RadarrAddOptions {
  tmdbId: number;
  title: string;
  qualityProfileId: number;
  rootFolderPath: string;
  monitored?: boolean;
  searchForMovie?: boolean;
}

export class RadarrError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = 'RadarrError';
  }
}

async function radarrFetch<T>(
  config: RadarrConfig,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${config.url.replace(/\/$/, '')}/api/v3${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'X-Api-Key': config.api_key,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new RadarrError(`Radarr API error: ${response.status} - ${errorText}`, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export const radarr = {
  async testConnection(
    config: RadarrConfig
  ): Promise<{ success: boolean; version?: string; error?: string }> {
    try {
      const status = await radarrFetch<{ version: string }>(config, '/system/status');
      return { success: true, version: status.version };
    } catch (error) {
      return {
        success: false,
        error: error instanceof RadarrError ? error.message : 'Failed to connect'
      };
    }
  },

  async getQualityProfiles(config: RadarrConfig): Promise<RadarrQualityProfile[]> {
    return radarrFetch(config, '/qualityprofile');
  },

  async getRootFolders(config: RadarrConfig): Promise<RadarrRootFolder[]> {
    return radarrFetch(config, '/rootfolder');
  },

  async lookupByTmdbId(config: RadarrConfig, tmdbId: number): Promise<RadarrMovie[]> {
    // Radarr v3 returns a single object for /movie/lookup/tmdb, not an array
    const result = await radarrFetch<RadarrMovie | RadarrMovie[]>(
      config,
      `/movie/lookup/tmdb?tmdbId=${tmdbId}`
    );
    return Array.isArray(result) ? result : [result];
  },

  async getAllMovies(config: RadarrConfig): Promise<RadarrMovie[]> {
    return radarrFetch(config, '/movie');
  },

  async getMovieByTmdbId(config: RadarrConfig, tmdbId: number): Promise<RadarrMovie | null> {
    const allMovies = await this.getAllMovies(config);
    return allMovies.find((m) => m.tmdbId === tmdbId) || null;
  },

  async addMovie(config: RadarrConfig, options: RadarrAddOptions): Promise<RadarrMovie> {
    // Lookup the movie first
    const lookupResults = await this.lookupByTmdbId(config, options.tmdbId);

    if (lookupResults.length === 0) {
      throw new RadarrError('Movie not found on TMDB');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const movie = lookupResults[0] as any;

    if (!movie || !movie.title || !movie.tmdbId) {
      throw new RadarrError(
        `Invalid lookup result for TMDB ID ${options.tmdbId}: missing title or tmdbId`
      );
    }

    // Check if already exists
    const existing = await this.getMovieByTmdbId(config, options.tmdbId);
    if (existing) {
      throw new RadarrError('Movie already exists in Radarr');
    }

    const payload = {
      ...movie,
      qualityProfileId: options.qualityProfileId,
      rootFolderPath: options.rootFolderPath,
      monitored: options.monitored ?? true,
      addOptions: {
        searchForMovie: options.searchForMovie ?? true
      }
    };

    return radarrFetch(config, '/movie', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }
};

// Database helpers for Radarr configs

export function getRadarrConfig(id: number, userId: number): RadarrConfig | undefined {
  return query.get<RadarrConfig>(
    'SELECT * FROM radarr_configs WHERE id = ? AND (user_id = ? OR user_id IS NULL)',
    [id, userId]
  );
}

export function getUserRadarrConfigs(userId: number): RadarrConfig[] {
  return query.all<RadarrConfig>(
    'SELECT * FROM radarr_configs WHERE user_id = ? OR user_id IS NULL ORDER BY is_default DESC, name ASC',
    [userId]
  );
}

export function createRadarrConfig(
  userId: number | null,
  name: string,
  url: string,
  apiKey: string,
  isDefault: boolean = false
): RadarrConfig {
  if (isDefault) {
    if (userId) {
      query.run('UPDATE radarr_configs SET is_default = 0 WHERE user_id = ?', [userId]);
    } else {
      query.run('UPDATE radarr_configs SET is_default = 0 WHERE user_id IS NULL');
    }
  }

  const result = query.run(
    'INSERT INTO radarr_configs (user_id, name, url, api_key, is_default) VALUES (?, ?, ?, ?, ?)',
    [userId, name, url, apiKey, isDefault ? 1 : 0]
  );

  return query.get<RadarrConfig>('SELECT * FROM radarr_configs WHERE id = ?', [
    result.lastInsertRowid
  ])!;
}

export function updateRadarrConfig(
  id: number,
  userId: number,
  updates: { name?: string; url?: string; apiKey?: string; isDefault?: boolean }
): RadarrConfig | undefined {
  const config = getRadarrConfig(id, userId);
  if (!config) return undefined;

  if (config.user_id !== null && config.user_id !== userId) {
    return undefined;
  }

  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.url !== undefined) {
    fields.push('url = ?');
    values.push(updates.url);
  }
  if (updates.apiKey !== undefined) {
    fields.push('api_key = ?');
    values.push(updates.apiKey);
  }
  if (updates.isDefault !== undefined) {
    if (updates.isDefault) {
      if (config.user_id) {
        query.run('UPDATE radarr_configs SET is_default = 0 WHERE user_id = ?', [config.user_id]);
      } else {
        query.run('UPDATE radarr_configs SET is_default = 0 WHERE user_id IS NULL');
      }
    }
    fields.push('is_default = ?');
    values.push(updates.isDefault ? 1 : 0);
  }

  if (fields.length === 0) return config;

  values.push(id);
  query.run(`UPDATE radarr_configs SET ${fields.join(', ')} WHERE id = ?`, values);

  return getRadarrConfig(id, userId);
}

export function deleteRadarrConfig(id: number, userId: number): boolean {
  const config = getRadarrConfig(id, userId);
  if (!config) return false;

  if (config.user_id !== null && config.user_id !== userId) {
    return false;
  }

  const result = query.run('DELETE FROM radarr_configs WHERE id = ?', [id]);
  return result.changes > 0;
}

// Radarr Library Cache Functions

export async function syncRadarrLibrary(config: RadarrConfig): Promise<number> {
  try {
    const movies = await radarr.getAllMovies(config);

    query.transaction(() => {
      query.run('DELETE FROM radarr_library WHERE config_id = ?', [config.id]);

      for (const m of movies) {
        query.run(
          `INSERT INTO radarr_library
           (config_id, radarr_id, tmdb_id, title, status, monitored, has_file, size_on_disk, path)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            config.id,
            m.id,
            m.tmdbId || null,
            m.title,
            m.status,
            m.monitored ? 1 : 0,
            m.hasFile ? 1 : 0,
            m.sizeOnDisk || m.movieFile?.size || 0,
            m.path || null
          ]
        );
      }

      query.run("UPDATE radarr_configs SET last_library_sync = datetime('now') WHERE id = ?", [
        config.id
      ]);
    });

    return movies.length;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.radarr.error(`Failed to sync library for config ${config.id}: ${errorMessage}`, {
      configId: config.id,
      error: errorMessage
    });
    throw error;
  }
}

export async function syncAllRadarrLibraries(): Promise<{ configId: number; count: number }[]> {
  const configs = query.all<RadarrConfig>('SELECT * FROM radarr_configs');
  const results: { configId: number; count: number }[] = [];

  for (const config of configs) {
    try {
      const count = await syncRadarrLibrary(config);
      results.push({ configId: config.id, count });
      logger.radarr.info(`Synced ${count} movies from "${config.name}"`, {
        configId: config.id,
        configName: config.name,
        movieCount: count
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.radarr.error(`Failed to sync config ${config.id}: ${errorMessage}`, {
        configId: config.id,
        error: errorMessage
      });
    }
  }

  return results;
}

// Get all TMDB IDs in Radarr for a user (across all their configs)
export function getUserRadarrTmdbIds(userId: number): Set<number> {
  const rows = query.all<{ tmdb_id: number }>(
    `SELECT DISTINCT rl.tmdb_id
     FROM radarr_library rl
     JOIN radarr_configs rc ON rl.config_id = rc.id
     WHERE (rc.user_id = ? OR rc.user_id IS NULL) AND rl.tmdb_id IS NOT NULL`,
    [userId]
  );
  return new Set(rows.map((r) => r.tmdb_id));
}

export interface RadarrInstanceInfo {
  configId: number;
  configName: string;
}

export function getUserRadarrTmdbMap(userId: number): Map<number, RadarrInstanceInfo[]> {
  const rows = query.all<{ tmdb_id: number; config_id: number; config_name: string }>(
    `SELECT rl.tmdb_id, rc.id as config_id, rc.name as config_name
     FROM radarr_library rl
     JOIN radarr_configs rc ON rl.config_id = rc.id
     WHERE (rc.user_id = ? OR rc.user_id IS NULL) AND rl.tmdb_id IS NOT NULL`,
    [userId]
  );

  const map = new Map<number, RadarrInstanceInfo[]>();
  for (const row of rows) {
    const existing = map.get(row.tmdb_id) || [];
    existing.push({ configId: row.config_id, configName: row.config_name });
    map.set(row.tmdb_id, existing);
  }
  return map;
}

export function getRadarrEntryByTmdbId(
  userId: number,
  tmdbId: number
): (RadarrLibraryEntry & { config_name: string }) | undefined {
  return query.get<RadarrLibraryEntry & { config_name: string }>(
    `SELECT rl.*, rc.name as config_name
     FROM radarr_library rl
     JOIN radarr_configs rc ON rl.config_id = rc.id
     WHERE (rc.user_id = ? OR rc.user_id IS NULL) AND rl.tmdb_id = ?
     LIMIT 1`,
    [userId, tmdbId]
  );
}
