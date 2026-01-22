import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getShows, getFilterOptions, getSyncStatus } from '$lib/server/shows';
import type { FilterConfig } from '$lib/types/filter';

export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '24', 10), 100);
  const search = url.searchParams.get('search') || undefined;

  // Parse filter from query params
  let filter: FilterConfig | undefined;
  const filterParam = url.searchParams.get('filter');
  if (filterParam) {
    try {
      filter = JSON.parse(filterParam);
    } catch {
      return json({ error: 'Invalid filter parameter' }, { status: 400 });
    }
  }

  const result = getShows({ filter, page, limit, search });

  return json(result);
};
