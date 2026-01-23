import type { PageServerLoad } from './$types';
import { getUserSonarrConfigs } from '$lib/server/sonarr';

export const load: PageServerLoad = async ({ locals }) => {
  const sonarrConfigs = getUserSonarrConfigs(locals.user!.id);

  // Don't expose API keys
  const safeConfigs = sonarrConfigs.map((c) => ({
    id: c.id,
    user_id: c.user_id,
    name: c.name,
    url: c.url,
    is_default: c.is_default,
    created_at: c.created_at,
    isShared: c.user_id === null
  }));

  return {
    sonarrConfigs: safeConfigs
  };
};
