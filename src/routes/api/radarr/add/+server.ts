import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { radarr, getRadarrConfig, RadarrError } from '$lib/server/radarr';
import { query } from '$lib/server/db';

// POST - Add movie to Radarr
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Restricted users cannot send to Radarr
  if (locals.user.role === 'restricted') {
    return json({ error: 'You do not have permission to add movies to Radarr' }, { status: 403 });
  }

  const { configId, tmdbId, title, qualityProfileId, rootFolderPath, movieId } =
    await request.json();

  if (!configId || !tmdbId) {
    return json({ error: 'Config ID and TMDB ID are required' }, { status: 400 });
  }

  if (!qualityProfileId || !rootFolderPath) {
    return json({ error: 'Quality profile and root folder are required' }, { status: 400 });
  }

  const config = getRadarrConfig(configId, locals.user.id);
  if (!config) {
    return json({ error: 'Radarr configuration not found' }, { status: 404 });
  }

  try {
    const movie = await radarr.addMovie(config, {
      tmdbId,
      title: title || 'Unknown',
      qualityProfileId,
      rootFolderPath,
      monitored: true,
      searchForMovie: true
    });

    // Track the request in our database
    if (movieId) {
      query.run(
        `INSERT INTO movie_requests (user_id, movie_id, radarr_config_id, radarr_movie_id, tmdb_id, status)
         VALUES (?, ?, ?, ?, ?, 'added')
         ON CONFLICT DO NOTHING`,
        [locals.user.id, movieId, configId, movie.id, tmdbId]
      );
    }

    return json({
      success: true,
      movie: {
        id: movie.id,
        title: movie.title,
        tmdbId: movie.tmdbId
      }
    });
  } catch (error) {
    console.error('Failed to add movie to Radarr:', error);

    // Track failed request
    if (movieId) {
      query.run(
        `INSERT INTO movie_requests (user_id, movie_id, radarr_config_id, tmdb_id, status)
         VALUES (?, ?, ?, ?, 'failed')
         ON CONFLICT DO NOTHING`,
        [locals.user.id, movieId, configId, tmdbId]
      );
    }

    if (error instanceof RadarrError) {
      return json({ error: error.message }, { status: error.status || 500 });
    }

    return json({ error: 'Failed to add movie to Radarr' }, { status: 500 });
  }
};
