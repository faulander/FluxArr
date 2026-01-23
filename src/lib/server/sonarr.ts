import { query } from './db';
import { logger } from './logger';

// Sonarr library cache entry
export interface SonarrLibraryEntry {
  id: number;
  config_id: number;
  sonarr_id: number;
  tvdb_id: number | null;
  title: string;
  status: string | null;
  monitored: number;
  episode_count: number;
  episode_file_count: number;
  size_on_disk: number;
  path: string | null;
  synced_at: string;
}

export interface SonarrConfig {
  id: number;
  user_id: number | null;
  name: string;
  url: string;
  api_key: string;
  is_default: number;
  created_at: string;
}

export interface SonarrQualityProfile {
  id: number;
  name: string;
}

export interface SonarrRootFolder {
  id: number;
  path: string;
  freeSpace: number;
}

export interface SonarrSeries {
  id: number;
  title: string;
  tvdbId: number;
  monitored: boolean;
  status: string;
  path?: string;
  statistics?: {
    episodeFileCount: number;
    episodeCount: number;
    totalEpisodeCount: number;
    sizeOnDisk: number;
    percentOfEpisodes: number;
  };
}

export interface SonarrAddOptions {
  tvdbId: number;
  title: string;
  qualityProfileId: number;
  rootFolderPath: string;
  monitored?: boolean;
  seasonFolder?: boolean;
  searchForMissingEpisodes?: boolean;
}

export class SonarrError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = 'SonarrError';
  }
}

async function sonarrFetch<T>(
  config: SonarrConfig,
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
    throw new SonarrError(`Sonarr API error: ${response.status} - ${errorText}`, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export const sonarr = {
  // Test connection to Sonarr
  async testConnection(
    config: SonarrConfig
  ): Promise<{ success: boolean; version?: string; error?: string }> {
    try {
      const status = await sonarrFetch<{ version: string }>(config, '/system/status');
      return { success: true, version: status.version };
    } catch (error) {
      return {
        success: false,
        error: error instanceof SonarrError ? error.message : 'Failed to connect'
      };
    }
  },

  // Get quality profiles
  async getQualityProfiles(config: SonarrConfig): Promise<SonarrQualityProfile[]> {
    return sonarrFetch(config, '/qualityprofile');
  },

  // Get root folders
  async getRootFolders(config: SonarrConfig): Promise<SonarrRootFolder[]> {
    return sonarrFetch(config, '/rootfolder');
  },

  // Search for series by TVDB ID
  async lookupByTvdbId(config: SonarrConfig, tvdbId: number): Promise<SonarrSeries[]> {
    return sonarrFetch(config, `/series/lookup?term=tvdb:${tvdbId}`);
  },

  // Get all series in Sonarr
  async getAllSeries(config: SonarrConfig): Promise<SonarrSeries[]> {
    return sonarrFetch(config, '/series');
  },

  // Check if series already exists in Sonarr
  async getSeriesByTvdbId(config: SonarrConfig, tvdbId: number): Promise<SonarrSeries | null> {
    const allSeries = await this.getAllSeries(config);
    return allSeries.find((s) => s.tvdbId === tvdbId) || null;
  },

  // Get all TVDB IDs in Sonarr library (for batch checking)
  async getLibraryTvdbIds(config: SonarrConfig): Promise<Map<number, SonarrSeries>> {
    const allSeries = await this.getAllSeries(config);
    const map = new Map<number, SonarrSeries>();
    for (const series of allSeries) {
      if (series.tvdbId) {
        map.set(series.tvdbId, series);
      }
    }
    return map;
  },

  // Add series to Sonarr
  async addSeries(config: SonarrConfig, options: SonarrAddOptions): Promise<SonarrSeries> {
    // First lookup the series to get full details
    const lookupResults = await this.lookupByTvdbId(config, options.tvdbId);

    if (lookupResults.length === 0) {
      throw new SonarrError('Series not found on TheTVDB');
    }

    const series = lookupResults[0];

    // Check if already exists
    const existing = await this.getSeriesByTvdbId(config, options.tvdbId);
    if (existing) {
      throw new SonarrError('Series already exists in Sonarr');
    }

    // Add the series
    const payload = {
      ...series,
      qualityProfileId: options.qualityProfileId,
      rootFolderPath: options.rootFolderPath,
      monitored: options.monitored ?? true,
      seasonFolder: options.seasonFolder ?? true,
      addOptions: {
        searchForMissingEpisodes: options.searchForMissingEpisodes ?? true
      }
    };

    return sonarrFetch(config, '/series', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }
};

// Database helpers for Sonarr configs

export function getSonarrConfig(id: number, userId: number): SonarrConfig | undefined {
  return query.get<SonarrConfig>(
    `SELECT * FROM sonarr_configs WHERE id = ? AND (user_id = ? OR user_id IS NULL)`,
    [id, userId]
  );
}

export function getUserSonarrConfigs(userId: number): SonarrConfig[] {
  return query.all<SonarrConfig>(
    `SELECT * FROM sonarr_configs WHERE user_id = ? OR user_id IS NULL ORDER BY is_default DESC, name ASC`,
    [userId]
  );
}

export function createSonarrConfig(
  userId: number | null,
  name: string,
  url: string,
  apiKey: string,
  isDefault: boolean = false
): SonarrConfig {
  // If setting as default, unset other defaults for this user
  if (isDefault) {
    if (userId) {
      query.run(`UPDATE sonarr_configs SET is_default = 0 WHERE user_id = ?`, [userId]);
    } else {
      query.run(`UPDATE sonarr_configs SET is_default = 0 WHERE user_id IS NULL`);
    }
  }

  const result = query.run(
    `INSERT INTO sonarr_configs (user_id, name, url, api_key, is_default) VALUES (?, ?, ?, ?, ?)`,
    [userId, name, url, apiKey, isDefault ? 1 : 0]
  );

  return query.get<SonarrConfig>(`SELECT * FROM sonarr_configs WHERE id = ?`, [
    result.lastInsertRowid
  ])!;
}

export function updateSonarrConfig(
  id: number,
  userId: number,
  updates: { name?: string; url?: string; apiKey?: string; isDefault?: boolean }
): SonarrConfig | undefined {
  const config = getSonarrConfig(id, userId);
  if (!config) return undefined;

  // Check ownership (user can only update their own, or admin can update shared)
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
      // Unset other defaults
      if (config.user_id) {
        query.run(`UPDATE sonarr_configs SET is_default = 0 WHERE user_id = ?`, [config.user_id]);
      } else {
        query.run(`UPDATE sonarr_configs SET is_default = 0 WHERE user_id IS NULL`);
      }
    }
    fields.push('is_default = ?');
    values.push(updates.isDefault ? 1 : 0);
  }

  if (fields.length === 0) return config;

  values.push(id);
  query.run(`UPDATE sonarr_configs SET ${fields.join(', ')} WHERE id = ?`, values);

  return getSonarrConfig(id, userId);
}

export function deleteSonarrConfig(id: number, userId: number): boolean {
  const config = getSonarrConfig(id, userId);
  if (!config) return false;

  // Check ownership
  if (config.user_id !== null && config.user_id !== userId) {
    return false;
  }

  const result = query.run(`DELETE FROM sonarr_configs WHERE id = ?`, [id]);
  return result.changes > 0;
}

// Sonarr Library Cache Functions

export async function syncSonarrLibrary(config: SonarrConfig): Promise<number> {
  try {
    const series = await sonarr.getAllSeries(config);

    query.transaction(() => {
      // Clear existing entries for this config
      query.run(`DELETE FROM sonarr_library WHERE config_id = ?`, [config.id]);

      // Insert all series
      const stmt = query.run;
      for (const s of series) {
        query.run(
          `INSERT INTO sonarr_library
           (config_id, sonarr_id, tvdb_id, title, status, monitored, episode_count, episode_file_count, size_on_disk, path)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            config.id,
            s.id,
            s.tvdbId || null,
            s.title,
            s.status,
            s.monitored ? 1 : 0,
            s.statistics?.episodeCount || 0,
            s.statistics?.episodeFileCount || 0,
            s.statistics?.sizeOnDisk || 0,
            s.path || null
          ]
        );
      }

      // Update last sync time
      query.run(`UPDATE sonarr_configs SET last_library_sync = datetime('now') WHERE id = ?`, [
        config.id
      ]);
    });

    return series.length;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.sonarr.error(`Failed to sync library for config ${config.id}: ${errorMessage}`, {
      configId: config.id,
      error: errorMessage
    });
    throw error;
  }
}

export async function syncAllSonarrLibraries(): Promise<{ configId: number; count: number }[]> {
  const configs = query.all<SonarrConfig>(`SELECT * FROM sonarr_configs`);
  const results: { configId: number; count: number }[] = [];

  for (const config of configs) {
    try {
      const count = await syncSonarrLibrary(config);
      results.push({ configId: config.id, count });
      logger.sonarr.info(`Synced ${count} series from "${config.name}"`, {
        configId: config.id,
        configName: config.name,
        seriesCount: count
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.sonarr.error(`Failed to sync config ${config.id}: ${errorMessage}`, {
        configId: config.id,
        error: errorMessage
      });
    }
  }

  return results;
}

// Get all TVDB IDs in Sonarr for a user (across all their configs)
export function getUserSonarrTvdbIds(userId: number): Set<number> {
  const rows = query.all<{ tvdb_id: number }>(
    `SELECT DISTINCT sl.tvdb_id
     FROM sonarr_library sl
     JOIN sonarr_configs sc ON sl.config_id = sc.id
     WHERE (sc.user_id = ? OR sc.user_id IS NULL) AND sl.tvdb_id IS NOT NULL`,
    [userId]
  );
  return new Set(rows.map((r) => r.tvdb_id));
}

// Get TVDB IDs mapped to their Sonarr config names
export interface SonarrInstanceInfo {
  configId: number;
  configName: string;
}

export function getUserSonarrTvdbMap(userId: number): Map<number, SonarrInstanceInfo[]> {
  const rows = query.all<{ tvdb_id: number; config_id: number; config_name: string }>(
    `SELECT sl.tvdb_id, sc.id as config_id, sc.name as config_name
     FROM sonarr_library sl
     JOIN sonarr_configs sc ON sl.config_id = sc.id
     WHERE (sc.user_id = ? OR sc.user_id IS NULL) AND sl.tvdb_id IS NOT NULL`,
    [userId]
  );

  const map = new Map<number, SonarrInstanceInfo[]>();
  for (const row of rows) {
    const existing = map.get(row.tvdb_id) || [];
    existing.push({ configId: row.config_id, configName: row.config_name });
    map.set(row.tvdb_id, existing);
  }
  return map;
}

// Get Sonarr library entry by TVDB ID for a user
export function getSonarrEntryByTvdbId(
  userId: number,
  tvdbId: number
): (SonarrLibraryEntry & { config_name: string }) | undefined {
  return query.get<SonarrLibraryEntry & { config_name: string }>(
    `SELECT sl.*, sc.name as config_name
     FROM sonarr_library sl
     JOIN sonarr_configs sc ON sl.config_id = sc.id
     WHERE (sc.user_id = ? OR sc.user_id IS NULL) AND sl.tvdb_id = ?
     LIMIT 1`,
    [userId, tvdbId]
  );
}

// Check if library needs refresh (older than 5 minutes)
export function libraryNeedsRefresh(configId: number): boolean {
  const config = query.get<{ last_library_sync: string | null }>(
    `SELECT last_library_sync FROM sonarr_configs WHERE id = ?`,
    [configId]
  );

  if (!config?.last_library_sync) return true;

  const lastSync = new Date(config.last_library_sync);
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  return lastSync < fiveMinutesAgo;
}
