import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getMovieById } from '$lib/server/movies';
import { query } from '$lib/server/db';
import { radarr, type RadarrQualityProfile, type RadarrRootFolder } from '$lib/server/radarr';

interface RadarrConfig {
  id: number;
  user_id: number | null;
  name: string;
  url: string;
  api_key: string;
  is_default: number;
  last_library_sync: string | null;
  created_at: string;
}

interface RadarrConfigWithOptions extends RadarrConfig {
  qualityProfiles: RadarrQualityProfile[];
  rootFolders: RadarrRootFolder[];
  hasMovie: boolean;
}

export const load: PageServerLoad = async ({ params, locals }) => {
  const id = parseInt(params.id, 10);

  if (isNaN(id)) {
    throw error(400, 'Invalid movie ID');
  }

  const movie = getMovieById(id);

  if (!movie) {
    throw error(404, 'Movie not found');
  }

  // Get user's Radarr configs
  const radarrConfigs = query.all<RadarrConfig>(
    `SELECT * FROM radarr_configs
     WHERE user_id = ? OR user_id IS NULL
     ORDER BY is_default DESC, name ASC`,
    [locals.user!.id]
  );

  // Check which configs already have this movie (by TMDB ID)
  const configsWithMovie = new Set<number>();
  const entries = query.all<{ config_id: number }>(
    `SELECT config_id FROM radarr_library WHERE tmdb_id = ?`,
    [id]
  );
  for (const entry of entries) {
    configsWithMovie.add(entry.config_id);
  }

  // Fetch quality profiles and root folders
  const radarrConfigsWithOptions = await Promise.all(
    radarrConfigs.map(async (config) => {
      const hasMovie = configsWithMovie.has(config.id);
      try {
        const [qualityProfiles, rootFolders] = await Promise.all([
          radarr.getQualityProfiles(config),
          radarr.getRootFolders(config)
        ]);
        return { ...config, qualityProfiles, rootFolders, hasMovie } as RadarrConfigWithOptions;
      } catch {
        return {
          ...config,
          qualityProfiles: [],
          rootFolders: [],
          hasMovie
        } as RadarrConfigWithOptions;
      }
    })
  );

  return {
    movie,
    radarrConfigs: radarrConfigsWithOptions
  };
};
