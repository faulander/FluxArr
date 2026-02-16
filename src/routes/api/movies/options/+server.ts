import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMovieFilterOptions } from '$lib/server/movies';

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const options = getMovieFilterOptions();

  return json({ options });
};
