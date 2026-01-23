import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getShowById } from '$lib/server/shows';
import { query } from '$lib/server/db';
import {
  getSonarrEntryByTvdbId,
  sonarr,
  type SonarrQualityProfile,
  type SonarrRootFolder
} from '$lib/server/sonarr';
import type { User } from '$lib/types';

interface SonarrConfig {
  id: number;
  user_id: number | null;
  name: string;
  url: string;
  api_key: string;
  is_default: number;
  created_at: string;
}

interface SonarrConfigWithOptions extends SonarrConfig {
  qualityProfiles: SonarrQualityProfile[];
  rootFolders: SonarrRootFolder[];
}

export const load: PageServerLoad = async ({ params, locals }) => {
  const id = parseInt(params.id, 10);

  if (isNaN(id)) {
    throw error(400, 'Invalid show ID');
  }

  const show = getShowById(id);

  if (!show) {
    throw error(404, 'Show not found');
  }

  // Get user's Sonarr configs (their own + shared ones)
  const sonarrConfigs = query.all<SonarrConfig>(
    `SELECT * FROM sonarr_configs
     WHERE user_id = ? OR user_id IS NULL
     ORDER BY is_default DESC, name ASC`,
    [locals.user!.id]
  );

  // Fetch quality profiles and root folders for each config
  const sonarrConfigsWithOptions: SonarrConfigWithOptions[] = await Promise.all(
    sonarrConfigs.map(async (config) => {
      try {
        const [qualityProfiles, rootFolders] = await Promise.all([
          sonarr.getQualityProfiles(config),
          sonarr.getRootFolders(config)
        ]);
        return { ...config, qualityProfiles, rootFolders };
      } catch (err) {
        console.error(`Failed to fetch options for Sonarr config ${config.id}:`, err);
        return { ...config, qualityProfiles: [], rootFolders: [] };
      }
    })
  );

  // Check if show is already in user's Sonarr library
  let sonarrEntry = null;
  if (show.thetvdb_id) {
    sonarrEntry = getSonarrEntryByTvdbId(locals.user!.id, show.thetvdb_id);
  }

  return {
    show,
    sonarrConfigs: sonarrConfigsWithOptions,
    sonarrEntry
  };
};
