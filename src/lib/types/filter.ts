export interface FilterInclude {
  languages?: string[];
  genres?: string[];
  status?: string[];
  networks?: string[];
  webChannels?: string[];
  countries?: string[];
  types?: string[];
  ratingMin?: number;
  ratingMax?: number;
  includeUnrated?: boolean;
  imdbRatingMin?: number;
  imdbRatingMax?: number;
  includeImdbUnrated?: boolean;
  premieredAfter?: string;
  premieredBefore?: string;
  runtimeMin?: number;
  runtimeMax?: number;
}

export interface FilterExclude {
  languages?: string[];
  genres?: string[];
  status?: string[];
  networks?: string[];
  webChannels?: string[];
  countries?: string[];
  types?: string[];
}

export interface FilterConfig {
  include: FilterInclude;
  exclude: FilterExclude;
  search?: string;
  sortBy?: 'name' | 'rating' | 'imdb_rating' | 'premiered' | 'updated';
  sortOrder?: 'asc' | 'desc';
}

export interface SavedFilter {
  id: number;
  user_id: number;
  name: string;
  config: string; // JSON string of FilterConfig
  is_default: number;
  created_at: string;
  updated_at: string;
}

export interface ParsedSavedFilter extends Omit<SavedFilter, 'config'> {
  config: FilterConfig;
}

export function parseFilter(filter: SavedFilter): ParsedSavedFilter {
  return {
    ...filter,
    config: JSON.parse(filter.config)
  };
}

// Default empty filter
export const defaultFilterConfig: FilterConfig = {
  include: {},
  exclude: {},
  sortBy: 'rating',
  sortOrder: 'desc'
};
