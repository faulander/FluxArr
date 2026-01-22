import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getFilterOptions, getSyncStatus } from '$lib/server/shows';

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const options = getFilterOptions();
  const syncStatus = getSyncStatus();

  return json({ options, syncStatus });
};
