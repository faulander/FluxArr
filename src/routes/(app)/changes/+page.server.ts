import type { PageServerLoad } from './$types';
import { getRecentChanges, getChangesCount } from '$lib/server/tvmaze-sync';

export const load: PageServerLoad = async ({ url }) => {
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = 50;
  const offset = (page - 1) * limit;

  const changes = getRecentChanges(limit, offset);
  const totalCount = getChangesCount();
  const totalPages = Math.ceil(totalCount / limit);

  return {
    changes,
    pagination: {
      page,
      totalPages,
      totalCount,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  };
};
