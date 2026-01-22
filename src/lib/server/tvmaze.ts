import type { TVMazeShow, TVMazeSearchResult, TVMazeUpdates } from '$lib/types';

const BASE_URL = 'https://api.tvmaze.com';

// Rate limiting: 20 calls per 10 seconds
const RATE_LIMIT_CALLS = 20;
const RATE_LIMIT_WINDOW = 10000; // 10 seconds in ms

class RateLimiter {
  private timestamps: number[] = [];

  async wait(): Promise<void> {
    const now = Date.now();

    // Remove timestamps outside the window
    this.timestamps = this.timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW);

    if (this.timestamps.length >= RATE_LIMIT_CALLS) {
      // Wait until the oldest timestamp expires
      const waitTime = RATE_LIMIT_WINDOW - (now - this.timestamps[0]) + 100;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      return this.wait(); // Recheck after waiting
    }

    this.timestamps.push(now);
  }
}

const rateLimiter = new RateLimiter();

async function fetchTVMaze<T>(endpoint: string): Promise<T> {
  await rateLimiter.wait();

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new TVMazeError('Not found', 404);
    }
    if (response.status === 429) {
      // Rate limited - wait and retry
      await new Promise((resolve) => setTimeout(resolve, 5000));
      return fetchTVMaze(endpoint);
    }
    throw new TVMazeError(`TVMaze API error: ${response.statusText}`, response.status);
  }

  return response.json();
}

export class TVMazeError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = 'TVMazeError';
  }
}

export const tvmaze = {
  // Search shows by query
  async searchShows(query: string): Promise<TVMazeSearchResult[]> {
    return fetchTVMaze(`/search/shows?q=${encodeURIComponent(query)}`);
  },

  // Single search (returns one result or null)
  async singleSearch(query: string): Promise<TVMazeShow | null> {
    try {
      return await fetchTVMaze(`/singlesearch/shows?q=${encodeURIComponent(query)}`);
    } catch (error) {
      if (error instanceof TVMazeError && error.status === 404) {
        return null;
      }
      throw error;
    }
  },

  // Get show by TVMaze ID
  async getShow(id: number): Promise<TVMazeShow> {
    return fetchTVMaze(`/shows/${id}`);
  },

  // Get show by external ID
  async lookupByTvdb(thetvdbId: number): Promise<TVMazeShow | null> {
    try {
      return await fetchTVMaze(`/lookup/shows?thetvdb=${thetvdbId}`);
    } catch (error) {
      if (error instanceof TVMazeError && error.status === 404) {
        return null;
      }
      throw error;
    }
  },

  async lookupByImdb(imdbId: string): Promise<TVMazeShow | null> {
    try {
      return await fetchTVMaze(`/lookup/shows?imdb=${imdbId}`);
    } catch (error) {
      if (error instanceof TVMazeError && error.status === 404) {
        return null;
      }
      throw error;
    }
  },

  // Get paginated show index (250 shows per page, 0-indexed)
  async getShowsPage(page: number): Promise<TVMazeShow[]> {
    try {
      return await fetchTVMaze(`/shows?page=${page}`);
    } catch (error) {
      if (error instanceof TVMazeError && error.status === 404) {
        // No more pages
        return [];
      }
      throw error;
    }
  },

  // Get show updates since a timeframe
  async getUpdates(since?: 'day' | 'week' | 'month'): Promise<TVMazeUpdates> {
    const query = since ? `?since=${since}` : '';
    return fetchTVMaze(`/updates/shows${query}`);
  },

  // Get all shows (generator for full sync)
  async *getAllShows(): AsyncGenerator<TVMazeShow[], void, unknown> {
    let page = 0;
    while (true) {
      const shows = await this.getShowsPage(page);
      if (shows.length === 0) break;
      yield shows;
      page++;
    }
  }
};
