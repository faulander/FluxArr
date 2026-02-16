import type { PageServerLoad } from './$types';
import { getMovies, getMovieFilterOptions } from '$lib/server/movies';
import { getUserRadarrTmdbMap, radarr, type RadarrInstanceInfo } from '$lib/server/radarr';
import { query } from '$lib/server/db';
import type { MovieFilterConfig } from '$lib/types/filter';

interface RadarrConfigRow {
  id: number;
  user_id: number | null;
  name: string;
  url: string;
  api_key: string;
  is_default: number;
  last_library_sync: string | null;
  created_at: string;
}

interface RadarrConfigForCard {
  id: number;
  name: string;
  is_default: number;
  qualityProfiles: { id: number; name: string }[];
  rootFolders: { id: number; path: string }[];
}

type SortOption =
  | 'vote_average'
  | 'imdb_rating'
  | 'title'
  | 'release_date'
  | 'popularity'
  | 'updated';
type SortOrder = 'asc' | 'desc';

const VALID_SORTS: SortOption[] = [
  'vote_average',
  'imdb_rating',
  'title',
  'release_date',
  'popularity',
  'updated'
];

export const load: PageServerLoad = async ({ url, locals }) => {
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const search = url.searchParams.get('search') || undefined;

  // Parse sort from URL
  const sortParam = url.searchParams.get('sort') as SortOption | null;
  const orderParam = url.searchParams.get('order') as SortOrder | null;
  const currentSort: SortOption = VALID_SORTS.includes(sortParam as SortOption)
    ? (sortParam as SortOption)
    : 'popularity';
  const currentSortOrder: SortOrder = orderParam === 'asc' ? 'asc' : 'desc';

  // Parse filter from URL
  let filter: MovieFilterConfig | undefined;
  const filterParam = url.searchParams.get('filter');
  let filtersExplicitlyCleared = false;

  if (filterParam) {
    try {
      const parsed = JSON.parse(filterParam);
      const hasInclude = parsed.include && Object.keys(parsed.include).length > 0;
      const hasExclude = parsed.exclude && Object.keys(parsed.exclude).length > 0;
      if (hasInclude || hasExclude) {
        filter = parsed;
      } else {
        filtersExplicitlyCleared = true;
      }
    } catch {
      // Invalid filter, ignore
    }
  }

  // Build the filter with sort options
  const filterWithSort: MovieFilterConfig = {
    include: filter?.include || {},
    exclude: filter?.exclude || {},
    sortBy: currentSort,
    sortOrder: currentSortOrder
  };

  const result = getMovies({ filter: filterWithSort, page, limit: 24, search });
  const filterOptions = getMovieFilterOptions();

  // Get movie sync status
  const syncStatus = query.get<{ is_syncing: number; last_full_sync: string | null }>(
    'SELECT is_syncing, last_full_sync FROM movie_sync_status WHERE id = 1'
  );

  // Get user's Radarr library - map of TMDB ID to instance info
  let radarrTmdbMap: Record<number, RadarrInstanceInfo[]> = {};
  let radarrConfigs: RadarrConfigForCard[] = [];

  if (locals.user) {
    const map = getUserRadarrTmdbMap(locals.user.id);
    radarrTmdbMap = Object.fromEntries(map);

    // Get user's Radarr configs for quick-add feature
    const configs = query.all<RadarrConfigRow>(
      `SELECT id, user_id, name, url, api_key, is_default, created_at FROM radarr_configs
       WHERE user_id = ? OR user_id IS NULL
       ORDER BY is_default DESC, name ASC`,
      [locals.user.id]
    );

    // Fetch quality profiles and root folders for each config
    radarrConfigs = await Promise.all(
      configs.map(async (config) => {
        try {
          const [qualityProfiles, rootFolders] = await Promise.all([
            radarr.getQualityProfiles(config),
            radarr.getRootFolders(config)
          ]);
          return {
            id: config.id,
            name: config.name,
            is_default: config.is_default,
            qualityProfiles: qualityProfiles.map((p) => ({ id: p.id, name: p.name })),
            rootFolders: rootFolders.map((f) => ({ id: f.id, path: f.path }))
          };
        } catch {
          return {
            id: config.id,
            name: config.name,
            is_default: config.is_default,
            qualityProfiles: [],
            rootFolders: []
          };
        }
      })
    );
  }

  return {
    ...result,
    filterOptions,
    syncStatus,
    currentFilter: filter,
    currentSearch: search,
    currentSort,
    currentSortOrder,
    radarrTmdbMap,
    radarrConfigs
  };
};
