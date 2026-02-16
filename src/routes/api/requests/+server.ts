import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { query } from '$lib/server/db';
import { sonarr, getSonarrConfig } from '$lib/server/sonarr';
import { radarr, getRadarrConfig } from '$lib/server/radarr';
import { tmdbPosterUrl } from '$lib/types/movie';

interface ShowRequestRow {
  id: number;
  user_id: number;
  show_id: number;
  sonarr_config_id: number;
  sonarr_series_id: number | null;
  tvdb_id: number | null;
  status: string;
  requested_at: string;
  updated_at: string;
  show_name: string;
  show_image: string | null;
  show_status: string | null;
  config_name: string;
  user_name: string;
}

interface MovieRequestRow {
  id: number;
  user_id: number;
  movie_id: number;
  radarr_config_id: number;
  radarr_movie_id: number | null;
  tmdb_id: number | null;
  status: string;
  requested_at: string;
  updated_at: string;
  movie_title: string;
  movie_poster: string | null;
  movie_status: string | null;
  config_name: string;
  user_name: string;
}

export interface RequestWithSonarrStatus {
  id: number;
  type: 'show';
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

export interface RequestWithRadarrStatus {
  id: number;
  type: 'movie';
  movieId: number;
  movieTitle: string;
  moviePoster: string | null;
  movieStatus: string | null;
  configId: number;
  configName: string;
  userId: number;
  userName: string;
  status: string;
  requestedAt: string;
  radarr: {
    movieId: number;
    monitored: boolean;
    status: string;
    hasFile: boolean;
    sizeOnDisk: number;
  } | null;
}

// GET - Fetch all requests with Sonarr/Radarr status
export const GET: RequestHandler = async ({ locals, url }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const includeAll = url.searchParams.get('all') === 'true' && locals.user.role === 'admin';
  const requestType = url.searchParams.get('type') || 'show';

  if (requestType === 'movie') {
    return json({ requests: await getMovieRequests(locals.user.id, includeAll) });
  }

  return json({ requests: await getShowRequests(locals.user.id, includeAll) });
};

async function getShowRequests(
  userId: number,
  includeAll: boolean
): Promise<RequestWithSonarrStatus[]> {
  const requests = query.all<ShowRequestRow>(
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
    includeAll ? [] : [userId]
  );

  // Group requests by Sonarr config to batch API calls
  const configGroups = new Map<number, ShowRequestRow[]>();
  for (const req of requests) {
    const group = configGroups.get(req.sonarr_config_id) || [];
    group.push(req);
    configGroups.set(req.sonarr_config_id, group);
  }

  // Fetch Sonarr status for each config
  const sonarrData = new Map<string, RequestWithSonarrStatus['sonarr']>();

  for (const [configId, configRequests] of configGroups) {
    const config = getSonarrConfig(configId, userId);
    if (!config) continue;

    try {
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

  return requests.map((req) => ({
    id: req.id,
    type: 'show' as const,
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
}

async function getMovieRequests(
  userId: number,
  includeAll: boolean
): Promise<RequestWithRadarrStatus[]> {
  const requests = query.all<MovieRequestRow>(
    `SELECT
       mr.id, mr.user_id, mr.movie_id, mr.radarr_config_id, mr.radarr_movie_id,
       mr.tmdb_id, mr.status, mr.requested_at, mr.updated_at,
       m.title as movie_title, m.poster_path as movie_poster, m.status as movie_status,
       rc.name as config_name,
       u.name as user_name
     FROM movie_requests mr
     JOIN movies m ON mr.movie_id = m.id
     JOIN radarr_configs rc ON mr.radarr_config_id = rc.id
     JOIN users u ON mr.user_id = u.id
     ${includeAll ? '' : 'WHERE mr.user_id = ?'}
     ORDER BY mr.requested_at DESC`,
    includeAll ? [] : [userId]
  );

  // Group by Radarr config
  const configGroups = new Map<number, MovieRequestRow[]>();
  for (const req of requests) {
    const group = configGroups.get(req.radarr_config_id) || [];
    group.push(req);
    configGroups.set(req.radarr_config_id, group);
  }

  // Fetch Radarr status
  const radarrData = new Map<string, RequestWithRadarrStatus['radarr']>();

  for (const [configId, configRequests] of configGroups) {
    const config = getRadarrConfig(configId, userId);
    if (!config) continue;

    try {
      const movies = await radarr.getAllMovies(config);
      const movieMap = new Map(movies.map((m) => [m.tmdbId, m]));

      for (const req of configRequests) {
        if (req.tmdb_id) {
          const m = movieMap.get(req.tmdb_id);
          if (m) {
            radarrData.set(`${configId}-${req.tmdb_id}`, {
              movieId: m.id,
              monitored: m.monitored,
              status: m.status,
              hasFile: m.hasFile,
              sizeOnDisk: m.sizeOnDisk || 0
            });
          }
        }
      }
    } catch (error) {
      console.error(`Failed to fetch Radarr data for config ${configId}:`, error);
    }
  }

  return requests.map((req) => ({
    id: req.id,
    type: 'movie' as const,
    movieId: req.movie_id,
    movieTitle: req.movie_title,
    moviePoster: req.movie_poster ? tmdbPosterUrl(req.movie_poster, 'w342') : null,
    movieStatus: req.movie_status,
    configId: req.radarr_config_id,
    configName: req.config_name,
    userId: req.user_id,
    userName: req.user_name,
    status: req.status,
    requestedAt: req.requested_at,
    radarr: req.tmdb_id ? radarrData.get(`${req.radarr_config_id}-${req.tmdb_id}`) || null : null
  }));
}

// DELETE - Remove a request (admin only or own request)
export const DELETE: RequestHandler = async ({ locals, url }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = parseInt(url.searchParams.get('id') || '', 10);
  const requestType = url.searchParams.get('type') || 'show';

  if (isNaN(id)) {
    return json({ error: 'Invalid request ID' }, { status: 400 });
  }

  const table = requestType === 'movie' ? 'movie_requests' : 'requests';

  const request = query.get<{ user_id: number }>(`SELECT user_id FROM ${table} WHERE id = ?`, [id]);
  if (!request) {
    return json({ error: 'Request not found' }, { status: 404 });
  }

  if (request.user_id !== locals.user.id && locals.user.role !== 'admin') {
    return json({ error: 'Forbidden' }, { status: 403 });
  }

  query.run(`DELETE FROM ${table} WHERE id = ?`, [id]);

  return json({ success: true });
};
