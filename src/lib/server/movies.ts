import { query } from './db';
import type { Movie } from '$lib/types';
import type { MovieFilterConfig } from '$lib/types/filter';

export interface MoviesQueryOptions {
  filter?: MovieFilterConfig;
  page?: number;
  limit?: number;
  search?: string;
}

export interface MoviesQueryResult {
  movies: Movie[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function getMovies(options: MoviesQueryOptions = {}): MoviesQueryResult {
  const { filter, page = 1, limit = 24, search } = options;

  const conditions: string[] = [];
  const params: unknown[] = [];

  // Full-text search with fallback to LIKE
  if (search && search.trim()) {
    const searchTerm = search.trim();
    const ftsSearchTerm = searchTerm.replace(/['"*]/g, '').split(/\s+/).join('* ') + '*';
    conditions.push(
      `(id IN (SELECT rowid FROM movies_fts WHERE movies_fts MATCH ?) OR title LIKE ?)`
    );
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
      const genreConditions = inc.genres.map(() => 'genres LIKE ?');
      conditions.push(`(${genreConditions.join(' OR ')})`);
      params.push(...inc.genres.map((g) => `%"${g}"%`));
    }

    if (inc.status?.length) {
      conditions.push(`status IN (${inc.status.map(() => '?').join(', ')})`);
      params.push(...inc.status);
    }

    if (inc.countries?.length) {
      const countryConditions = inc.countries.map(() => 'production_countries LIKE ?');
      conditions.push(`(${countryConditions.join(' OR ')})`);
      params.push(...inc.countries.map((c) => `%"${c}"%`));
    }

    // TMDB vote_average rating filter
    if (inc.ratingMin !== undefined || inc.ratingMax !== undefined) {
      const ratingConditions: string[] = [];

      if (inc.ratingMin !== undefined && inc.ratingMax !== undefined) {
        ratingConditions.push('(vote_average >= ? AND vote_average <= ?)');
        params.push(inc.ratingMin, inc.ratingMax);
      } else if (inc.ratingMin !== undefined) {
        ratingConditions.push('vote_average >= ?');
        params.push(inc.ratingMin);
      } else if (inc.ratingMax !== undefined) {
        ratingConditions.push('vote_average <= ?');
        params.push(inc.ratingMax);
      }

      if (inc.includeUnrated) {
        ratingConditions.push('vote_average IS NULL');
      }

      if (ratingConditions.length > 0) {
        conditions.push(`(${ratingConditions.join(' OR ')})`);
      }
    }

    // IMDB rating filter
    if (inc.imdbRatingMin !== undefined || inc.imdbRatingMax !== undefined) {
      const imdbConditions: string[] = [];

      if (inc.imdbRatingMin !== undefined && inc.imdbRatingMax !== undefined) {
        imdbConditions.push('(imdb_rating >= ? AND imdb_rating <= ?)');
        params.push(inc.imdbRatingMin, inc.imdbRatingMax);
      } else if (inc.imdbRatingMin !== undefined) {
        imdbConditions.push('imdb_rating >= ?');
        params.push(inc.imdbRatingMin);
      } else if (inc.imdbRatingMax !== undefined) {
        imdbConditions.push('imdb_rating <= ?');
        params.push(inc.imdbRatingMax);
      }

      if (inc.includeImdbUnrated) {
        imdbConditions.push('imdb_rating IS NULL');
      }

      if (imdbConditions.length > 0) {
        conditions.push(`(${imdbConditions.join(' OR ')})`);
      }
    }

    if (inc.releasedAfter) {
      conditions.push('release_date >= ?');
      params.push(inc.releasedAfter);
    }

    if (inc.releasedBefore) {
      conditions.push('release_date <= ?');
      params.push(inc.releasedBefore);
    }

    if (inc.runtimeMin !== undefined) {
      conditions.push('runtime >= ?');
      params.push(inc.runtimeMin);
    }

    if (inc.runtimeMax !== undefined) {
      conditions.push('runtime <= ?');
      params.push(inc.runtimeMax);
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
      for (const genre of exc.genres) {
        conditions.push('genres NOT LIKE ?');
        params.push(`%"${genre}"%`);
      }
    }

    if (exc.status?.length) {
      conditions.push(
        `(status IS NULL OR status NOT IN (${exc.status.map(() => '?').join(', ')}))`
      );
      params.push(...exc.status);
    }

    if (exc.countries?.length) {
      for (const country of exc.countries) {
        conditions.push('(production_countries IS NULL OR production_countries NOT LIKE ?)');
        params.push(`%"${country}"%`);
      }
    }
  }

  // Build WHERE clause
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Sorting
  let orderBy = 'popularity DESC NULLS LAST';
  if (filter?.sortBy) {
    const direction = filter.sortOrder === 'asc' ? 'ASC' : 'DESC';
    const nulls = filter.sortOrder === 'asc' ? 'NULLS FIRST' : 'NULLS LAST';
    switch (filter.sortBy) {
      case 'title':
        orderBy = `title ${direction}`;
        break;
      case 'vote_average':
        orderBy = `vote_average ${direction} ${nulls}`;
        break;
      case 'imdb_rating':
        orderBy = `imdb_rating ${direction} ${nulls}`;
        break;
      case 'release_date':
        orderBy = `release_date ${direction} ${nulls}`;
        break;
      case 'popularity':
        orderBy = `popularity ${direction} ${nulls}`;
        break;
      case 'updated':
        orderBy = `updated_at ${direction}`;
        break;
    }
  }

  // Get total count
  const countResult = query.get<{ count: number }>(
    `SELECT COUNT(*) as count FROM movies ${whereClause}`,
    params
  );
  const total = countResult?.count || 0;

  // Get paginated results
  const offset = (page - 1) * limit;
  const movies = query.all<Movie>(
    `SELECT * FROM movies ${whereClause} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return {
    movies,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
}

export function getMovieById(id: number): Movie | undefined {
  return query.get<Movie>('SELECT * FROM movies WHERE id = ?', [id]);
}

// Get distinct values for filter dropdowns
export function getMovieFilterOptions(): {
  languages: string[];
  genres: string[];
  status: string[];
  countries: string[];
} {
  const languages = query
    .all<{ language: string }>(
      'SELECT DISTINCT language FROM movies WHERE language IS NOT NULL ORDER BY language'
    )
    .map((r) => r.language);

  // Genres are stored as JSON arrays
  const genreRows = query.all<{ genres: string }>(
    "SELECT DISTINCT genres FROM movies WHERE genres IS NOT NULL AND genres != '[]'"
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
    .all<{ status: string }>(
      'SELECT DISTINCT status FROM movies WHERE status IS NOT NULL ORDER BY status'
    )
    .map((r) => r.status);

  // Countries from production_countries JSON arrays
  const countryRows = query.all<{ production_countries: string }>(
    "SELECT DISTINCT production_countries FROM movies WHERE production_countries IS NOT NULL AND production_countries != '[]'"
  );
  const countrySet = new Set<string>();
  for (const row of countryRows) {
    try {
      const arr = JSON.parse(row.production_countries);
      for (const c of arr) countrySet.add(c);
    } catch {
      // ignore invalid JSON
    }
  }
  const countries = Array.from(countrySet).sort();

  return { languages, genres, status, countries };
}
