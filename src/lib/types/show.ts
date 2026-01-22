// TVMaze API response types
export interface TVMazeShow {
  id: number;
  url: string;
  name: string;
  type: string;
  language: string | null;
  genres: string[];
  status: string;
  runtime: number | null;
  averageRuntime: number | null;
  premiered: string | null;
  ended: string | null;
  officialSite: string | null;
  schedule: {
    time: string;
    days: string[];
  };
  rating: {
    average: number | null;
  };
  weight: number;
  network: {
    id: number;
    name: string;
    country: {
      name: string;
      code: string;
      timezone: string;
    } | null;
    officialSite: string | null;
  } | null;
  webChannel: {
    id: number;
    name: string;
    country: {
      name: string;
      code: string;
      timezone: string;
    } | null;
    officialSite: string | null;
  } | null;
  dvdCountry: unknown | null;
  externals: {
    tvrage: number | null;
    thetvdb: number | null;
    imdb: string | null;
  };
  image: {
    medium: string;
    original: string;
  } | null;
  summary: string | null;
  updated: number;
  _links: {
    self: { href: string };
    previousepisode?: { href: string; name: string };
    nextepisode?: { href: string; name: string };
  };
}

export interface TVMazeSearchResult {
  score: number;
  show: TVMazeShow;
}

export interface TVMazeUpdates {
  [showId: string]: number; // showId -> timestamp
}

// Database model
export interface Show {
  id: number;
  name: string;
  slug: string | null;
  type: string | null;
  language: string | null;
  genres: string; // JSON array stored as string
  status: string | null;
  runtime: number | null;
  average_runtime: number | null;
  premiered: string | null;
  ended: string | null;
  official_site: string | null;
  schedule_time: string | null;
  schedule_days: string | null; // JSON array stored as string
  rating_average: number | null;
  weight: number | null;
  network_id: number | null;
  network_name: string | null;
  network_country_name: string | null;
  network_country_code: string | null;
  web_channel_id: number | null;
  web_channel_name: string | null;
  web_channel_country_code: string | null;
  image_medium: string | null;
  image_original: string | null;
  summary: string | null;
  imdb_id: string | null;
  thetvdb_id: number | null;
  tvrage_id: number | null;
  updated_at: number;
  synced_at: string;
}

// Parsed show with arrays instead of JSON strings
export interface ParsedShow extends Omit<Show, 'genres' | 'schedule_days'> {
  genres: string[];
  schedule_days: string[];
}

// Helper to parse show from DB
export function parseShow(show: Show): ParsedShow {
  return {
    ...show,
    genres: show.genres ? JSON.parse(show.genres) : [],
    schedule_days: show.schedule_days ? JSON.parse(show.schedule_days) : []
  };
}

// Helper to convert TVMaze show to DB row
export function tvMazeToDbShow(show: TVMazeShow): Omit<Show, 'synced_at'> {
  return {
    id: show.id,
    name: show.name,
    slug: show.url.split('/').pop() || null,
    type: show.type,
    language: show.language,
    genres: JSON.stringify(show.genres),
    status: show.status,
    runtime: show.runtime,
    average_runtime: show.averageRuntime,
    premiered: show.premiered,
    ended: show.ended,
    official_site: show.officialSite,
    schedule_time: show.schedule.time || null,
    schedule_days: JSON.stringify(show.schedule.days),
    rating_average: show.rating.average,
    weight: show.weight,
    network_id: show.network?.id || null,
    network_name: show.network?.name || null,
    network_country_name: show.network?.country?.name || null,
    network_country_code: show.network?.country?.code || null,
    web_channel_id: show.webChannel?.id || null,
    web_channel_name: show.webChannel?.name || null,
    web_channel_country_code: show.webChannel?.country?.code || null,
    image_medium: show.image?.medium || null,
    image_original: show.image?.original || null,
    summary: show.summary,
    imdb_id: show.externals.imdb,
    thetvdb_id: show.externals.thetvdb,
    tvrage_id: show.externals.tvrage,
    updated_at: show.updated
  };
}

// Sync status
export interface SyncStatus {
  id: number;
  last_full_sync: string | null;
  last_incremental_sync: string | null;
  total_shows: number;
  is_syncing: number;
  sync_progress: string | null;
}

export interface SyncProgress {
  current: number;
  total: number;
  phase: 'full' | 'incremental';
}
