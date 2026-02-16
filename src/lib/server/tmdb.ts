// TMDB API client for fetching movie data
// API documentation: https://developer.themoviedb.org/reference

import { query } from './db';
import { logger } from './logger';
import type { TMDBMovie, TMDBMovieListResult, TMDBChangesResult, TMDBGenre } from '$lib/types';

const BASE_URL = 'https://api.themoviedb.org/3';

interface TMDBConfig {
  id: number;
  api_key: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

// Genre ID-to-name mapping cache (populated on first use)
let genreMap: Map<number, string> | null = null;

export function getTMDBConfig(): TMDBConfig | null {
  return query.get<TMDBConfig>('SELECT * FROM tmdb_config WHERE id = 1') || null;
}

export function saveTMDBConfig(apiKey: string, enabled: boolean): void {
  const existing = getTMDBConfig();

  if (existing) {
    query.run(
      'UPDATE tmdb_config SET api_key = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1',
      [apiKey, enabled ? 1 : 0]
    );
  } else {
    query.run('INSERT INTO tmdb_config (id, api_key, enabled) VALUES (1, ?, ?)', [
      apiKey,
      enabled ? 1 : 0
    ]);
  }
}

export function isTMDBEnabled(): boolean {
  const config = getTMDBConfig();
  return config !== null && config.enabled === 1 && config.api_key.length > 0;
}

export async function testTMDBConnection(
  apiKey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${BASE_URL}/configuration?api_key=${apiKey}`);
    if (response.ok) {
      return { success: true };
    }
    const data = await response.json();
    return { success: false, error: data.status_message || 'Invalid API key' };
  } catch {
    return { success: false, error: 'Failed to connect to TMDB API' };
  }
}

// Rate limiting - TMDB allows 50 req/s, use conservative 200ms delay for bulk
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 200; // ms between requests during bulk operations

async function rateLimitedFetch<T>(url: string): Promise<T | null> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL) {
    await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_INTERVAL - elapsed));
  }
  lastRequestTime = Date.now();

  const response = await fetch(url, {
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    if (response.status === 429) {
      // Rate limited - wait and retry
      const retryAfter = parseInt(response.headers.get('Retry-After') || '2', 10);
      logger.tmdb.warn(`Rate limited, waiting ${retryAfter}s`);
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
      return rateLimitedFetch(url);
    }
    if (response.status === 404) return null;
    throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function fetchTMDB<T>(endpoint: string, apiKey: string, params: Record<string, string> = {}): Promise<T | null> {
  const searchParams = new URLSearchParams({ api_key: apiKey, ...params });
  return rateLimitedFetch<T>(`${BASE_URL}${endpoint}?${searchParams}`);
}

/**
 * Fetch and cache genre mapping from TMDB.
 * List endpoints return genre_ids (numbers), detail endpoints return full genre objects.
 */
export async function getGenreMap(apiKey: string): Promise<Map<number, string>> {
  if (genreMap) return genreMap;

  const data = await fetchTMDB<{ genres: TMDBGenre[] }>('/genre/movie/list', apiKey);
  genreMap = new Map();
  if (data?.genres) {
    for (const g of data.genres) {
      genreMap.set(g.id, g.name);
    }
  }
  return genreMap;
}

/**
 * Resolve genre_ids from list endpoints to genre name strings.
 */
function resolveGenreIds(genreIds: number[] | undefined, map: Map<number, string>): string[] {
  if (!genreIds) return [];
  return genreIds.map((id) => map.get(id)).filter((name): name is string => !!name);
}

/**
 * Fetch a single movie's full details by TMDB ID.
 */
export async function fetchMovieDetails(tmdbId: number, apiKey: string): Promise<TMDBMovie | null> {
  return fetchTMDB<TMDBMovie>(`/movie/${tmdbId}`, apiKey);
}

/**
 * Fetch a page of popular movies.
 */
export async function fetchPopularMovies(apiKey: string, page: number = 1): Promise<TMDBMovieListResult | null> {
  return fetchTMDB<TMDBMovieListResult>('/movie/popular', apiKey, { page: String(page) });
}

/**
 * Fetch a page of top-rated movies.
 */
export async function fetchTopRatedMovies(apiKey: string, page: number = 1): Promise<TMDBMovieListResult | null> {
  return fetchTMDB<TMDBMovieListResult>('/movie/top_rated', apiKey, { page: String(page) });
}

/**
 * Fetch movies via discover endpoint with flexible params.
 */
export async function discoverMovies(
  apiKey: string,
  page: number = 1,
  params: Record<string, string> = {}
): Promise<TMDBMovieListResult | null> {
  return fetchTMDB<TMDBMovieListResult>('/discover/movie', apiKey, {
    page: String(page),
    sort_by: 'popularity.desc',
    'vote_count.gte': '50',
    ...params
  });
}

/**
 * Fetch movie changes in a date range (for incremental sync).
 * Returns IDs of movies that changed.
 */
export async function fetchMovieChanges(
  apiKey: string,
  startDate: string,
  endDate: string,
  page: number = 1
): Promise<TMDBChangesResult | null> {
  return fetchTMDB<TMDBChangesResult>('/movie/changes', apiKey, {
    start_date: startDate,
    end_date: endDate,
    page: String(page)
  });
}

/**
 * Search movies by query string.
 */
export async function searchMovies(
  apiKey: string,
  queryStr: string,
  page: number = 1
): Promise<TMDBMovieListResult | null> {
  return fetchTMDB<TMDBMovieListResult>('/search/movie', apiKey, {
    query: queryStr,
    page: String(page)
  });
}

/**
 * Convert a TMDB movie (from detail endpoint) to DB column values.
 * Detail endpoint returns full genre objects, list endpoint returns genre_ids.
 */
export function tmdbMovieToDbValues(
  movie: TMDBMovie,
  genreMapRef?: Map<number, string>
): Record<string, unknown> {
  // Resolve genres: detail endpoint has .genres as objects, list endpoint has .genre_ids as numbers
  let genreNames: string[];
  if (movie.genres && Array.isArray(movie.genres) && movie.genres.length > 0 && typeof movie.genres[0] === 'object') {
    genreNames = movie.genres.map((g) => g.name);
  } else if (movie.genre_ids && genreMapRef) {
    genreNames = resolveGenreIds(movie.genre_ids, genreMapRef);
  } else {
    genreNames = [];
  }

  const slug = movie.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return {
    id: movie.id,
    title: movie.title,
    original_title: movie.original_title || null,
    slug,
    language: movie.original_language || null,
    genres: JSON.stringify(genreNames),
    status: movie.status || null,
    runtime: movie.runtime || null,
    release_date: movie.release_date || null,
    revenue: movie.revenue || null,
    budget: movie.budget || null,
    vote_average: movie.vote_average || null,
    vote_count: movie.vote_count || null,
    popularity: movie.popularity || null,
    imdb_id: movie.imdb_id || null,
    poster_path: movie.poster_path || null,
    backdrop_path: movie.backdrop_path || null,
    overview: movie.overview || null,
    tagline: movie.tagline || null,
    production_companies: movie.production_companies
      ? JSON.stringify(movie.production_companies)
      : null,
    production_countries: movie.production_countries
      ? JSON.stringify(movie.production_countries.map((c) => c.iso_3166_1))
      : null,
    spoken_languages: movie.spoken_languages
      ? JSON.stringify(movie.spoken_languages.map((l) => l.english_name || l.name))
      : null,
    updated_at: new Date().toISOString()
  };
}
