import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getShowById } from '$lib/server/shows';
import { query } from '$lib/server/db';
import { sonarr, type SonarrQualityProfile, type SonarrRootFolder } from '$lib/server/sonarr';
import { fetchShowCastCrew } from '$lib/server/tvmaze-sync';

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
  hasShow: boolean; // Whether this config already has the show
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

  // Check which configs already have this show
  const configsWithShow = new Set<number>();
  if (show.thetvdb_id) {
    const entries = query.all<{ config_id: number }>(
      `SELECT config_id FROM sonarr_library WHERE tvdb_id = ?`,
      [show.thetvdb_id]
    );
    for (const entry of entries) {
      configsWithShow.add(entry.config_id);
    }
  }

  // Fetch quality profiles, root folders, and cast/crew in parallel
  const [sonarrConfigsWithOptions, castCrew] = await Promise.all([
    Promise.all(
      sonarrConfigs.map(async (config) => {
        const hasShow = configsWithShow.has(config.id);
        try {
          const [qualityProfiles, rootFolders] = await Promise.all([
            sonarr.getQualityProfiles(config),
            sonarr.getRootFolders(config)
          ]);
          return { ...config, qualityProfiles, rootFolders, hasShow } as SonarrConfigWithOptions;
        } catch (err) {
          console.error(`Failed to fetch options for Sonarr config ${config.id}:`, err);
          return {
            ...config,
            qualityProfiles: [],
            rootFolders: [],
            hasShow
          } as SonarrConfigWithOptions;
        }
      })
    ),
    fetchShowCastCrew(id)
  ]);

  return {
    show,
    sonarrConfigs: sonarrConfigsWithOptions,
    cast: castCrew.cast,
    crew: castCrew.crew
  };
};
