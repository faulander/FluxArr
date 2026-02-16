import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMovies } from '$lib/server/movies';
import type { MovieFilterConfig } from '$lib/types/filter';

type SortOption = 'vote_average' | 'imdb_rating' | 'title' | 'release_date' | 'popularity' | 'updated';
type SortOrder = 'asc' | 'desc';

const VALID_SORTS: SortOption[] = ['vote_average', 'imdb_rating', 'title', 'release_date', 'popularity', 'updated'];

export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '24', 10), 100);
  const search = url.searchParams.get('search') || undefined;

  // Parse sort from query params
  const sortParam = url.searchParams.get('sort') as SortOption | null;
  const orderParam = url.searchParams.get('order') as SortOrder | null;
  const sortBy: SortOption = VALID_SORTS.includes(sortParam as SortOption)
    ? (sortParam as SortOption)
    : 'popularity';
  const sortOrder: SortOrder = orderParam === 'asc' ? 'asc' : 'desc';

  // Parse filter from query params
  let filter: MovieFilterConfig | undefined;
  const filterParam = url.searchParams.get('filter');
  if (filterParam) {
    try {
      filter = JSON.parse(filterParam);
    } catch {
      return json({ error: 'Invalid filter parameter' }, { status: 400 });
    }
  }

  // Build filter with sort options
  const filterWithSort: MovieFilterConfig = {
    include: filter?.include || {},
    exclude: filter?.exclude || {},
    sortBy,
    sortOrder
  };

  const result = getMovies({ filter: filterWithSort, page, limit, search });

  return json(result);
};
