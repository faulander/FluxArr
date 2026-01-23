import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { query } from '$lib/server/db';
import { sonarr, getSonarrConfig } from '$lib/server/sonarr';

interface RequestRow {
  id: number;
  user_id: number;
  show_id: number;
  sonarr_config_id: number;
  sonarr_series_id: number | null;
  tvdb_id: number | null;
  status: string;
  requested_at: string;
  updated_at: string;
  // Joined fields
  show_name: string;
  show_image: string | null;
  show_status: string | null;
  config_name: string;
  user_name: string;
}

export interface RequestWithSonarrStatus {
  id: number;
  showId: number;
  showName: string;
  showImage: string | null;
  showStatus: string | null;
  configId: number;
  configName: string;
  userId: number;
  userName: string;
  status: string;
  requestedAt: string;
  // Sonarr data
  sonarr: {
    seriesId: number;
    monitored: boolean;
    status: string;
    episodeFileCount: number;
    episodeCount: number;
    totalEpisodeCount: number;
    sizeOnDisk: number;
    percentOfEpisodes: number;
  } | null;
}

// GET - Fetch all requests with Sonarr status
export const GET: RequestHandler = async ({ locals, url }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const includeAll = url.searchParams.get('all') === 'true' && locals.user.role === 'admin';

  // Get requests - admins can see all, users see only their own
  const requests = query.all<RequestRow>(
    `SELECT
       r.id, r.user_id, r.show_id, r.sonarr_config_id, r.sonarr_series_id,
       r.tvdb_id, r.status, r.requested_at, r.updated_at,
       s.name as show_name, s.image_medium as show_image, s.status as show_status,
       sc.name as config_name,
       u.name as user_name
     FROM requests r
     JOIN shows s ON r.show_id = s.id
     JOIN sonarr_configs sc ON r.sonarr_config_id = sc.id
     JOIN users u ON r.user_id = u.id
     ${includeAll ? '' : 'WHERE r.user_id = ?'}
     ORDER BY r.requested_at DESC`,
    includeAll ? [] : [locals.user.id]
  );

  // Group requests by Sonarr config to batch API calls
  const configGroups = new Map<number, RequestRow[]>();
  for (const req of requests) {
    const group = configGroups.get(req.sonarr_config_id) || [];
    group.push(req);
    configGroups.set(req.sonarr_config_id, group);
  }

  // Fetch Sonarr status for each config
  const sonarrData = new Map<string, RequestWithSonarrStatus['sonarr']>();

  for (const [configId, configRequests] of configGroups) {
    const config = getSonarrConfig(configId, locals.user.id);
    if (!config) continue;

    try {
      // Get all series from this Sonarr instance
      const series = await sonarr.getAllSeries(config);
      const seriesMap = new Map(series.map((s) => [s.tvdbId, s]));

      for (const req of configRequests) {
        if (req.tvdb_id) {
          const s = seriesMap.get(req.tvdb_id);
          if (s) {
            sonarrData.set(`${configId}-${req.tvdb_id}`, {
              seriesId: s.id,
              monitored: s.monitored,
              status: s.status,
              episodeFileCount: s.statistics?.episodeFileCount || 0,
              episodeCount: s.statistics?.episodeCount || 0,
              totalEpisodeCount: s.statistics?.totalEpisodeCount || 0,
              sizeOnDisk: s.statistics?.sizeOnDisk || 0,
              percentOfEpisodes: s.statistics?.percentOfEpisodes || 0
            });
          }
        }
      }
    } catch (error) {
      console.error(`Failed to fetch Sonarr data for config ${configId}:`, error);
    }
  }

  // Build response
  const result: RequestWithSonarrStatus[] = requests.map((req) => ({
    id: req.id,
    showId: req.show_id,
    showName: req.show_name,
    showImage: req.show_image,
    showStatus: req.show_status,
    configId: req.sonarr_config_id,
    configName: req.config_name,
    userId: req.user_id,
    userName: req.user_name,
    status: req.status,
    requestedAt: req.requested_at,
    sonarr: req.tvdb_id ? sonarrData.get(`${req.sonarr_config_id}-${req.tvdb_id}`) || null : null
  }));

  return json({ requests: result });
};

// DELETE - Remove a request (admin only or own request)
export const DELETE: RequestHandler = async ({ locals, url }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = parseInt(url.searchParams.get('id') || '', 10);
  if (isNaN(id)) {
    return json({ error: 'Invalid request ID' }, { status: 400 });
  }

  // Check ownership or admin
  const request = query.get<{ user_id: number }>('SELECT user_id FROM requests WHERE id = ?', [id]);
  if (!request) {
    return json({ error: 'Request not found' }, { status: 404 });
  }

  if (request.user_id !== locals.user.id && locals.user.role !== 'admin') {
    return json({ error: 'Forbidden' }, { status: 403 });
  }

  query.run('DELETE FROM requests WHERE id = ?', [id]);

  return json({ success: true });
};
