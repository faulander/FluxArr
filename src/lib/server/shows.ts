import { query } from './db';
import type { Show, SyncStatus } from '$lib/types';
import type { FilterConfig } from '$lib/types/filter';

export interface ShowsQueryOptions {
  filter?: FilterConfig;
  page?: number;
  limit?: number;
  search?: string;
}

export interface ShowsQueryResult {
  shows: Show[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function getShows(options: ShowsQueryOptions = {}): ShowsQueryResult {
  const { filter, page = 1, limit = 24, search } = options;

  const conditions: string[] = [];
  const params: unknown[] = [];

  // Full-text search with fallback to LIKE for partial matches
  if (search && search.trim()) {
    const searchTerm = search.trim();
    // Use FTS5 for prefix matching OR LIKE for contains matching
    // This handles both "into" (prefix match) and "badlands" (contains match for "Into the Badlands")
    const ftsSearchTerm = searchTerm.replace(/['"*]/g, '').split(/\s+/).join('* ') + '*';
    conditions.push(`(id IN (SELECT rowid FROM shows_fts WHERE shows_fts MATCH ?) OR name LIKE ?)`);
    params.push(ftsSearchTerm, `%${searchTerm}%`);
  }

  // Apply inclusion filters
  if (filter?.include) {
    const inc = filter.include;

    if (inc.languages?.length) {
      conditions.push(`language IN (${inc.languages.map(() => '?').join(', ')})`);
      params.push(...inc.languages);
    }

    if (inc.genres?.length) {
      // Show must have at least one of these genres
      const genreConditions = inc.genres.map(() => `genres LIKE ?`);
      conditions.push(`(${genreConditions.join(' OR ')})`);
      params.push(...inc.genres.map((g) => `%"${g}"%`));
    }

    if (inc.status?.length) {
      conditions.push(`status IN (${inc.status.map(() => '?').join(', ')})`);
      params.push(...inc.status);
    }

    if (inc.networks?.length) {
      conditions.push(`network_name IN (${inc.networks.map(() => '?').join(', ')})`);
      params.push(...inc.networks);
    }

    if (inc.webChannels?.length) {
      conditions.push(`web_channel_name IN (${inc.webChannels.map(() => '?').join(', ')})`);
      params.push(...inc.webChannels);
    }

    if (inc.countries?.length) {
      conditions.push(
        `(network_country_code IN (${inc.countries.map(() => '?').join(', ')}) OR web_channel_country_code IN (${inc.countries.map(() => '?').join(', ')}))`
      );
      params.push(...inc.countries, ...inc.countries);
    }

    if (inc.types?.length) {
      conditions.push(`type IN (${inc.types.map(() => '?').join(', ')})`);
      params.push(...inc.types);
    }

    if (inc.ratingMin !== undefined || inc.ratingMax !== undefined) {
      const ratingConditions: string[] = [];

      if (inc.ratingMin !== undefined && inc.ratingMax !== undefined) {
        ratingConditions.push(`(rating_average >= ? AND rating_average <= ?)`);
        params.push(inc.ratingMin, inc.ratingMax);
      } else if (inc.ratingMin !== undefined) {
        ratingConditions.push(`rating_average >= ?`);
        params.push(inc.ratingMin);
      } else if (inc.ratingMax !== undefined) {
        ratingConditions.push(`rating_average <= ?`);
        params.push(inc.ratingMax);
      }

      if (inc.includeUnrated) {
        ratingConditions.push(`rating_average IS NULL`);
      }

      if (ratingConditions.length > 0) {
        conditions.push(`(${ratingConditions.join(' OR ')})`);
      }
    } else if (inc.includeUnrated) {
      // Only includeUnrated is set, no rating filter - no condition needed
      // Shows with and without ratings will be included
    }

    if (inc.imdbRatingMin !== undefined || inc.imdbRatingMax !== undefined) {
      const imdbConditions: string[] = [];

      if (inc.imdbRatingMin !== undefined && inc.imdbRatingMax !== undefined) {
        imdbConditions.push(`(imdb_rating >= ? AND imdb_rating <= ?)`);
        params.push(inc.imdbRatingMin, inc.imdbRatingMax);
      } else if (inc.imdbRatingMin !== undefined) {
        imdbConditions.push(`imdb_rating >= ?`);
        params.push(inc.imdbRatingMin);
      } else if (inc.imdbRatingMax !== undefined) {
        imdbConditions.push(`imdb_rating <= ?`);
        params.push(inc.imdbRatingMax);
      }

      if (inc.includeImdbUnrated) {
        imdbConditions.push(`imdb_rating IS NULL`);
      }

      if (imdbConditions.length > 0) {
        conditions.push(`(${imdbConditions.join(' OR ')})`);
      }
    }

    if (inc.premieredAfter) {
      conditions.push(`premiered >= ?`);
      params.push(inc.premieredAfter);
    }

    if (inc.premieredBefore) {
      conditions.push(`premiered <= ?`);
      params.push(inc.premieredBefore);
    }

    if (inc.runtimeMin !== undefined) {
      conditions.push(`(runtime >= ? OR average_runtime >= ?)`);
      params.push(inc.runtimeMin, inc.runtimeMin);
    }

    if (inc.runtimeMax !== undefined) {
      conditions.push(`(runtime <= ? OR average_runtime <= ?)`);
      params.push(inc.runtimeMax, inc.runtimeMax);
    }
  }

  // Apply exclusion filters
  if (filter?.exclude) {
    const exc = filter.exclude;

    if (exc.languages?.length) {
      conditions.push(
        `(language IS NULL OR language NOT IN (${exc.languages.map(() => '?').join(', ')}))`
      );
      params.push(...exc.languages);
    }

    if (exc.genres?.length) {
      // Exclude if has ANY of these genres
      for (const genre of exc.genres) {
        conditions.push(`genres NOT LIKE ?`);
        params.push(`%"${genre}"%`);
      }
    }

    if (exc.status?.length) {
      conditions.push(
        `(status IS NULL OR status NOT IN (${exc.status.map(() => '?').join(', ')}))`
      );
      params.push(...exc.status);
    }

    if (exc.networks?.length) {
      conditions.push(
        `(network_name IS NULL OR network_name NOT IN (${exc.networks.map(() => '?').join(', ')}))`
      );
      params.push(...exc.networks);
    }

    if (exc.webChannels?.length) {
      conditions.push(
        `(web_channel_name IS NULL OR web_channel_name NOT IN (${exc.webChannels.map(() => '?').join(', ')}))`
      );
      params.push(...exc.webChannels);
    }

    if (exc.countries?.length) {
      conditions.push(
        `(network_country_code IS NULL OR network_country_code NOT IN (${exc.countries.map(() => '?').join(', ')}))`
      );
      conditions.push(
        `(web_channel_country_code IS NULL OR web_channel_country_code NOT IN (${exc.countries.map(() => '?').join(', ')}))`
      );
      params.push(...exc.countries, ...exc.countries);
    }

    if (exc.types?.length) {
      conditions.push(`(type IS NULL OR type NOT IN (${exc.types.map(() => '?').join(', ')}))`);
      params.push(...exc.types);
    }
  }

  // Build WHERE clause
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Sorting
  let orderBy = 'rating_average DESC NULLS LAST';
  if (filter?.sortBy) {
    const direction = filter.sortOrder === 'asc' ? 'ASC' : 'DESC';
    const nulls = filter.sortOrder === 'asc' ? 'NULLS FIRST' : 'NULLS LAST';
    switch (filter.sortBy) {
      case 'name':
        orderBy = `name ${direction}`;
        break;
      case 'rating':
        orderBy = `rating_average ${direction} ${nulls}`;
        break;
      case 'imdb_rating':
        orderBy = `imdb_rating ${direction} ${nulls}`;
        break;
      case 'premiered':
        orderBy = `premiered ${direction} ${nulls}`;
        break;
      case 'updated':
        orderBy = `updated_at ${direction}`;
        break;
    }
  }

  // Get total count
  const countResult = query.get<{ count: number }>(
    `SELECT COUNT(*) as count FROM shows ${whereClause}`,
    params
  );
  const total = countResult?.count || 0;

  // Get paginated results
  const offset = (page - 1) * limit;
  const shows = query.all<Show>(
    `SELECT * FROM shows ${whereClause} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return {
    shows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
}

export function getShowById(id: number): Show | undefined {
  return query.get<Show>(`SELECT * FROM shows WHERE id = ?`, [id]);
}

export function getSyncStatus(): SyncStatus | undefined {
  return query.get<SyncStatus>(`SELECT * FROM sync_status WHERE id = 1`);
}

// Get distinct values for filter dropdowns
export function getFilterOptions(): {
  languages: string[];
  genres: string[];
  status: string[];
  networks: string[];
  webChannels: string[];
  countries: string[];
  types: string[];
} {
  const languages = query
    .all<{
      language: string;
    }>(`SELECT DISTINCT language FROM shows WHERE language IS NOT NULL ORDER BY language`)
    .map((r) => r.language);

  // Genres are stored as JSON arrays, need to extract unique values
  const genreRows = query.all<{ genres: string }>(
    `SELECT DISTINCT genres FROM shows WHERE genres IS NOT NULL AND genres != '[]'`
  );
  const genreSet = new Set<string>();
  for (const row of genreRows) {
    try {
      const arr = JSON.parse(row.genres);
      for (const g of arr) genreSet.add(g);
    } catch {
      // ignore invalid JSON
    }
  }
  const genres = Array.from(genreSet).sort();

  const status = query
    .all<{
      status: string;
    }>(`SELECT DISTINCT status FROM shows WHERE status IS NOT NULL ORDER BY status`)
    .map((r) => r.status);

  const networks = query
    .all<{
      network_name: string;
    }>(
      `SELECT DISTINCT network_name FROM shows WHERE network_name IS NOT NULL ORDER BY network_name`
    )
    .map((r) => r.network_name);

  const webChannels = query
    .all<{
      web_channel_name: string;
    }>(
      `SELECT DISTINCT web_channel_name FROM shows WHERE web_channel_name IS NOT NULL ORDER BY web_channel_name`
    )
    .map((r) => r.web_channel_name);

  const countryRows = query.all<{ code: string }>(`
    SELECT DISTINCT network_country_code as code FROM shows WHERE network_country_code IS NOT NULL
    UNION
    SELECT DISTINCT web_channel_country_code as code FROM shows WHERE web_channel_country_code IS NOT NULL
    ORDER BY code
  `);
  const countries = countryRows.map((r) => r.code);

  const types = query
    .all<{ type: string }>(`SELECT DISTINCT type FROM shows WHERE type IS NOT NULL ORDER BY type`)
    .map((r) => r.type);

  return { languages, genres, status, networks, webChannels, countries, types };
}
