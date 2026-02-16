// TMDB API response types
export interface TMDBMovie {
  id: number;
  title: string;
  original_title: string;
  original_language: string;
  genres: { id: number; name: string }[];
  genre_ids?: number[]; // Used in list endpoints instead of full genre objects
  status: string;
  runtime: number | null;
  release_date: string;
  revenue: number;
  budget: number;
  vote_average: number;
  vote_count: number;
  popularity: number;
  imdb_id: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  tagline: string;
  production_companies: { id: number; name: string; origin_country: string }[];
  production_countries: { iso_3166_1: string; name: string }[];
  spoken_languages: { iso_639_1: string; name: string; english_name: string }[];
}

export interface TMDBMovieListResult {
  page: number;
  results: TMDBMovie[];
  total_pages: number;
  total_results: number;
}

export interface TMDBChangesResult {
  results: { id: number; adult: boolean }[];
  page: number;
  total_pages: number;
  total_results: number;
}

export interface TMDBGenre {
  id: number;
  name: string;
}

// Database model
export interface Movie {
  id: number;
  title: string;
  original_title: string | null;
  slug: string | null;
  language: string | null;
  genres: string; // JSON array stored as string
  status: string | null;
  runtime: number | null;
  release_date: string | null;
  revenue: number | null;
  budget: number | null;
  vote_average: number | null;
  vote_count: number | null;
  popularity: number | null;
  imdb_id: string | null;
  imdb_rating: number | null;
  imdb_rating_updated_at: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string | null;
  tagline: string | null;
  production_companies: string | null; // JSON array stored as string
  production_countries: string | null; // JSON array stored as string
  spoken_languages: string | null; // JSON array stored as string
  updated_at: string | null;
  synced_at: string;
}

// Parsed movie with arrays instead of JSON strings
export interface ParsedMovie extends Omit<Movie, 'genres' | 'production_companies' | 'production_countries' | 'spoken_languages'> {
  genres: string[];
  production_companies: { id: number; name: string; origin_country: string }[];
  production_countries: string[];
  spoken_languages: string[];
}

// Helper to parse movie from DB
export function parseMovie(movie: Movie): ParsedMovie {
  return {
    ...movie,
    genres: movie.genres ? JSON.parse(movie.genres) : [],
    production_companies: movie.production_companies ? JSON.parse(movie.production_companies) : [],
    production_countries: movie.production_countries ? JSON.parse(movie.production_countries) : [],
    spoken_languages: movie.spoken_languages ? JSON.parse(movie.spoken_languages) : []
  };
}

// Movie sync status
export interface MovieSyncStatus {
  id: number;
  last_full_sync: string | null;
  last_incremental_sync: string | null;
  total_movies: number;
  is_syncing: number;
  sync_progress: string | null;
}

// TMDB image URL helpers
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/';

export function tmdbPosterUrl(path: string | null, size: 'w342' | 'w500' | 'original' = 'w342'): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}${size}${path}`;
}

export function tmdbBackdropUrl(path: string | null, size: 'w780' | 'w1280' | 'original' = 'w780'): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}${size}${path}`;
}
