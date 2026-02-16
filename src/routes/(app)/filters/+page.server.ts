import type { PageServerLoad } from './$types';
import { query } from '$lib/server/db';
import { getFilterOptions } from '$lib/server/shows';
import { getMovieFilterOptions } from '$lib/server/movies';
import type { SavedFilter } from '$lib/types/filter';

export const load: PageServerLoad = async ({ locals }) => {
  const filters = query.all<SavedFilter>(
    `SELECT * FROM filters WHERE user_id = ? ORDER BY is_default DESC, name ASC`,
    [locals.user!.id]
  );

  const filterOptions = getFilterOptions();
  const movieFilterOptions = getMovieFilterOptions();

  return {
    filters,
    filterOptions,
    movieFilterOptions
  };
};
