import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sonarr, getSonarrConfig, SonarrError } from '$lib/server/sonarr';
import { query } from '$lib/server/db';

// POST - Add series to Sonarr
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Restricted users cannot send to Sonarr
  if (locals.user.role === 'restricted') {
    return json({ error: 'You do not have permission to add shows to Sonarr' }, { status: 403 });
  }

  const { configId, tvdbId, title, qualityProfileId, rootFolderPath, showId } =
    await request.json();

  if (!configId || !tvdbId) {
    return json({ error: 'Config ID and TVDB ID are required' }, { status: 400 });
  }

  if (!qualityProfileId || !rootFolderPath) {
    return json({ error: 'Quality profile and root folder are required' }, { status: 400 });
  }

  const config = getSonarrConfig(configId, locals.user.id);
  if (!config) {
    return json({ error: 'Sonarr configuration not found' }, { status: 404 });
  }

  try {
    const series = await sonarr.addSeries(config, {
      tvdbId,
      title: title || 'Unknown',
      qualityProfileId,
      rootFolderPath,
      monitored: true,
      seasonFolder: true,
      searchForMissingEpisodes: true
    });

    // Track the request in our database
    if (showId) {
      query.run(
        `INSERT INTO requests (user_id, show_id, sonarr_config_id, sonarr_series_id, tvdb_id, status)
         VALUES (?, ?, ?, ?, ?, 'added')
         ON CONFLICT DO NOTHING`,
        [locals.user.id, showId, configId, series.id, tvdbId]
      );
    }

    return json({
      success: true,
      series: {
        id: series.id,
        title: series.title,
        tvdbId: series.tvdbId
      }
    });
  } catch (error) {
    console.error('Failed to add series to Sonarr:', error);

    // Track failed request
    if (showId) {
      query.run(
        `INSERT INTO requests (user_id, show_id, sonarr_config_id, tvdb_id, status)
         VALUES (?, ?, ?, ?, 'failed')
         ON CONFLICT DO NOTHING`,
        [locals.user.id, showId, configId, tvdbId]
      );
    }

    if (error instanceof SonarrError) {
      return json({ error: error.message }, { status: error.status || 500 });
    }

    return json({ error: 'Failed to add series to Sonarr' }, { status: 500 });
  }
};
