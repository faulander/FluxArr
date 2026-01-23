import type { PageServerLoad } from './$types';
import { getShows, getFilterOptions, getSyncStatus } from '$lib/server/shows';
import { getUserSonarrTvdbMap, type SonarrInstanceInfo } from '$lib/server/sonarr';
import type { FilterConfig } from '$lib/types/filter';

export const load: PageServerLoad = async ({ url, locals }) => {
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const search = url.searchParams.get('search') || undefined;

  // Parse filter from URL
  let filter: FilterConfig | undefined;
  const filterParam = url.searchParams.get('filter');
  if (filterParam) {
    try {
      filter = JSON.parse(filterParam);
    } catch {
      // Invalid filter, ignore
    }
  }

  const result = getShows({ filter, page, limit: 24, search });
  const filterOptions = getFilterOptions();
  const syncStatus = getSyncStatus();

  // Get user's Sonarr library - map of TVDB ID to instance info
  let sonarrTvdbMap: Record<number, SonarrInstanceInfo[]> = {};
  if (locals.user) {
    const map = getUserSonarrTvdbMap(locals.user.id);
    // Convert Map to plain object for serialization
    sonarrTvdbMap = Object.fromEntries(map);
  }

  return {
    ...result,
    filterOptions,
    syncStatus,
    currentFilter: filter,
    currentSearch: search,
    sonarrTvdbMap
  };
};
