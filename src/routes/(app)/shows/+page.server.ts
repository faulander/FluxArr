import type { PageServerLoad } from './$types';
import { getShows, getFilterOptions, getSyncStatus } from '$lib/server/shows';
import { getUserSonarrTvdbIds } from '$lib/server/sonarr';
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

  // Get user's Sonarr library TVDB IDs for highlighting shows already in Sonarr
  let sonarrTvdbIds: number[] = [];
  if (locals.user) {
    sonarrTvdbIds = Array.from(getUserSonarrTvdbIds(locals.user.id));
  }

  return {
    ...result,
    filterOptions,
    syncStatus,
    currentFilter: filter,
    currentSearch: search,
    sonarrTvdbIds
  };
};
