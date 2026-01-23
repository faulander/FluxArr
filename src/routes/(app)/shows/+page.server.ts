import type { PageServerLoad } from './$types';
import { getShows, getFilterOptions, getSyncStatus } from '$lib/server/shows';
import { getUserSonarrTvdbMap, sonarr, type SonarrInstanceInfo } from '$lib/server/sonarr';
import { query } from '$lib/server/db';
import type { FilterConfig } from '$lib/types/filter';

interface SonarrConfigRow {
  id: number;
  user_id: number | null;
  name: string;
  url: string;
  api_key: string;
  is_default: number;
  created_at: string;
}

interface SonarrConfigForCard {
  id: number;
  name: string;
  is_default: number;
  qualityProfiles: { id: number; name: string }[];
  rootFolders: { id: number; path: string }[];
}

export const load: PageServerLoad = async ({ url, locals }) => {
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const search = url.searchParams.get('search') || undefined;

  // Parse filter from URL
  let filter: FilterConfig | undefined;
  let defaultFilterName: string | undefined;
  const filterParam = url.searchParams.get('filter');

  // Track if user explicitly cleared filters (filter param exists but is empty)
  let filtersExplicitlyCleared = false;

  if (filterParam) {
    // Explicit filter in URL - use it (even if empty, to override default)
    try {
      const parsed = JSON.parse(filterParam);
      // Check if it's an empty filter (user cleared filters)
      const hasInclude = parsed.include && Object.keys(parsed.include).length > 0;
      const hasExclude = parsed.exclude && Object.keys(parsed.exclude).length > 0;
      if (hasInclude || hasExclude) {
        filter = parsed;
      } else {
        // Empty filter - user explicitly cleared, don't apply default
        filtersExplicitlyCleared = true;
      }
    } catch {
      // Invalid filter, ignore
    }
  }

  if (!filter && !filtersExplicitlyCleared && locals.user) {
    // No filter in URL and not explicitly cleared - check for user's default filter
    const defaultFilter = query.get<{ name: string; config: string }>(
      `SELECT name, config FROM filters WHERE user_id = ? AND is_default = 1`,
      [locals.user.id]
    );
    if (defaultFilter) {
      try {
        filter = JSON.parse(defaultFilter.config);
        defaultFilterName = defaultFilter.name;
      } catch {
        // Invalid config, ignore
      }
    }
  }

  const result = getShows({ filter, page, limit: 24, search });
  const filterOptions = getFilterOptions();
  const syncStatus = getSyncStatus();

  // Get user's Sonarr library - map of TVDB ID to instance info
  let sonarrTvdbMap: Record<number, SonarrInstanceInfo[]> = {};
  let sonarrConfigs: SonarrConfigForCard[] = [];

  if (locals.user) {
    const map = getUserSonarrTvdbMap(locals.user.id);
    // Convert Map to plain object for serialization
    sonarrTvdbMap = Object.fromEntries(map);

    // Get user's Sonarr configs for quick-add feature
    const configs = query.all<SonarrConfigRow>(
      `SELECT id, user_id, name, url, api_key, is_default, created_at FROM sonarr_configs
       WHERE user_id = ? OR user_id IS NULL
       ORDER BY is_default DESC, name ASC`,
      [locals.user.id]
    );

    // Fetch quality profiles and root folders for each config
    sonarrConfigs = await Promise.all(
      configs.map(async (config) => {
        try {
          const [qualityProfiles, rootFolders] = await Promise.all([
            sonarr.getQualityProfiles(config),
            sonarr.getRootFolders(config)
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
    defaultFilterName,
    sonarrTvdbMap,
    sonarrConfigs
  };
};
