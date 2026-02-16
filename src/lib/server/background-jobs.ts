import { syncAllSonarrLibraries } from './sonarr';
import { runIncrementalSync } from './tvmaze-sync';
import { runMovieIncrementalSync } from './tmdb-sync';
import { isTMDBEnabled } from './tmdb';
import { syncIMDBRatings, calculateBatchSize, isOMDBEnabled } from './omdb';
import { query } from './db';
import { logger } from './logger';

interface JobDefinition {
  id: string;
  name: string;
  description: string;
  defaultInterval: number;
  run: () => Promise<void>;
}

interface JobState {
  interval: ReturnType<typeof setInterval> | null;
  isRunning: boolean;
  lastRun: Date | null;
  lastResult: 'success' | 'error' | null;
  lastError: string | null;
  nextRun: Date | null;
}

interface JobConfig {
  id: string;
  enabled: number;
  interval_minutes: number;
  last_run: string | null;
}

const jobStates = new Map<string, JobState>();

// Job definitions
const jobs: JobDefinition[] = [
  {
    id: 'sonarr-sync',
    name: 'Sonarr Library Sync',
    description: 'Synchronizes library data from all configured Sonarr instances',
    defaultInterval: 5,
    run: async () => {
      const results = await syncAllSonarrLibraries();
      const total = results.reduce((sum, r) => sum + r.count, 0);
      logger.sonarr.info(`Sync complete: ${results.length} configs, ${total} total series`, {
        configs: results.length,
        totalSeries: total
      });
    }
  },
  {
    id: 'tvmaze-sync',
    name: 'TVMaze Data Sync',
    description: 'Updates TV show data from TVMaze API (shows updated in last 24 hours)',
    defaultInterval: 60,
    run: async () => {
      const result = await runIncrementalSync();
      logger.tvmaze.info(`Sync complete: updated ${result.updated} shows, total ${result.total}`, {
        updated: result.updated,
        total: result.total
      });
    }
  },
  {
    id: 'omdb-sync',
    name: 'OMDB IMDB Ratings Sync',
    description: 'Fetches IMDB ratings from OMDB API (batch size auto-calculated from plan limit)',
    defaultInterval: 15,
    run: async () => {
      if (!isOMDBEnabled()) {
        logger.omdb.info('OMDB not configured or disabled, skipping');
        return;
      }
      const config = getJobConfig('omdb-sync');
      const interval = config?.interval_minutes || 15;
      const batchSize = calculateBatchSize(interval);
      const result = await syncIMDBRatings(batchSize);
      logger.omdb.info(
        `Sync complete: ${result.updated} updated, ${result.errors} errors out of ${result.total}`,
        { updated: result.updated, errors: result.errors, total: result.total, batchSize }
      );
    }
  },
  {
    id: 'tmdb-sync',
    name: 'TMDB Movie Sync',
    description:
      'Syncs movie data from TMDB (seeds on first run, then incremental updates every 6 hours)',
    defaultInterval: 360,
    run: async () => {
      if (!isTMDBEnabled()) {
        logger.tmdb.info('TMDB not configured or disabled, skipping');
        return;
      }
      const result = await runMovieIncrementalSync();
      logger.tmdb.info(`Sync complete: ${result.updated} updated, ${result.total} total movies`, {
        updated: result.updated,
        total: result.total
      });
    }
  }
];

function getJobConfig(jobId: string): JobConfig | undefined {
  return query.get<JobConfig>('SELECT * FROM job_configs WHERE id = ?', [jobId]);
}

function ensureJobConfig(job: JobDefinition): JobConfig {
  let config = getJobConfig(job.id);
  if (!config) {
    query.run('INSERT INTO job_configs (id, enabled, interval_minutes) VALUES (?, 1, ?)', [
      job.id,
      job.defaultInterval
    ]);
    config = getJobConfig(job.id)!;
  }
  return config;
}

async function runJob(job: JobDefinition) {
  const state = jobStates.get(job.id);
  if (!state) return;

  if (state.isRunning) {
    logger.background.debug(`${job.name} already running, skipping`);
    return;
  }

  state.isRunning = true;
  logger.background.info(`Starting ${job.name}`);

  try {
    await job.run();
    state.lastResult = 'success';
    state.lastError = null;
    logger.background.info(`${job.name} completed successfully`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.background.error(`${job.name} failed: ${errorMessage}`, { error: errorMessage });
    state.lastResult = 'error';
    state.lastError = errorMessage;
  } finally {
    state.isRunning = false;
    state.lastRun = new Date();

    // Persist last_run to database
    query.run('UPDATE job_configs SET last_run = ? WHERE id = ?', [
      state.lastRun.toISOString(),
      job.id
    ]);

    updateNextRun(job.id);
  }
}

function updateNextRun(jobId: string) {
  const state = jobStates.get(jobId);
  const config = getJobConfig(jobId);
  if (state && config && config.enabled) {
    state.nextRun = new Date(Date.now() + config.interval_minutes * 60 * 1000);
  } else if (state) {
    state.nextRun = null;
  }
}

function scheduleJob(job: JobDefinition, forceRun = false) {
  const config = ensureJobConfig(job);
  let state = jobStates.get(job.id);

  if (!state) {
    state = {
      interval: null,
      isRunning: false,
      lastRun: null,
      lastResult: null,
      lastError: null,
      nextRun: null
    };
    jobStates.set(job.id, state);
  }

  // Restore last_run from database
  if (config.last_run) {
    state.lastRun = new Date(config.last_run);
  }

  // Clear existing interval
  if (state.interval) {
    clearInterval(state.interval);
    state.interval = null;
  }

  if (!config.enabled) {
    state.nextRun = null;
    logger.background.info(`${job.name} is disabled`);
    return;
  }

  const intervalMs = config.interval_minutes * 60 * 1000;

  // Calculate time until next run based on last run
  let delayUntilFirstRun = 0;

  if (forceRun) {
    // Manual trigger or explicit request to run now
    delayUntilFirstRun = 0;
  } else if (state.lastRun) {
    const timeSinceLastRun = Date.now() - state.lastRun.getTime();
    const timeUntilNextRun = intervalMs - timeSinceLastRun;

    if (timeUntilNextRun > 0) {
      // Not due yet, wait until next scheduled time
      delayUntilFirstRun = timeUntilNextRun;
      logger.background.info(
        `${job.name} last ran ${Math.round(timeSinceLastRun / 60000)} min ago, next run in ${Math.round(timeUntilNextRun / 60000)} min`
      );
    } else {
      // Overdue, run soon (small delay to avoid all jobs starting at once)
      delayUntilFirstRun = Math.random() * 5000;
      logger.background.info(`${job.name} is overdue, running shortly`);
    }
  } else {
    // Never run before, run soon
    delayUntilFirstRun = Math.random() * 5000;
    logger.background.info(`${job.name} has never run, starting shortly`);
  }

  // Update next run time
  state.nextRun = new Date(Date.now() + delayUntilFirstRun);

  // Schedule first run
  if (delayUntilFirstRun > 0) {
    setTimeout(() => {
      runJob(job);
      // After first run completes, schedule recurring
      const currentState = jobStates.get(job.id);
      if (currentState && !currentState.interval) {
        currentState.interval = setInterval(() => runJob(job), intervalMs);
      }
    }, delayUntilFirstRun);
  } else {
    runJob(job);
  }

  // Schedule recurring (only if not waiting for delayed first run)
  if (delayUntilFirstRun === 0) {
    state.interval = setInterval(() => runJob(job), intervalMs);
  }

  logger.background.info(`${job.name} scheduled every ${config.interval_minutes} minutes`);
}

export function startBackgroundJobs() {
  logger.background.info('Starting background jobs');

  for (const job of jobs) {
    scheduleJob(job);
  }
}

export function stopBackgroundJobs() {
  logger.background.info('Stopping background jobs');

  for (const [, state] of jobStates) {
    if (state.interval) {
      clearInterval(state.interval);
      state.interval = null;
    }
    state.nextRun = null;
  }
}

// Manual trigger for immediate job run
export async function triggerJob(jobId: string): Promise<boolean> {
  const job = jobs.find((j) => j.id === jobId);
  if (!job) return false;

  logger.background.info(`Manually triggered ${job.name}`);
  await runJob(job);
  return true;
}

// Legacy export for backwards compatibility
export async function triggerSonarrSync() {
  await triggerJob('sonarr-sync');
}

// Update job configuration
export function updateJobConfig(
  jobId: string,
  updates: { enabled?: boolean; interval_minutes?: number }
): boolean {
  const job = jobs.find((j) => j.id === jobId);
  if (!job) return false;

  const config = getJobConfig(jobId);
  if (!config) return false;

  if (updates.enabled !== undefined) {
    query.run('UPDATE job_configs SET enabled = ? WHERE id = ?', [updates.enabled ? 1 : 0, jobId]);
    logger.background.info(`${job.name} ${updates.enabled ? 'enabled' : 'disabled'}`);
  }

  if (updates.interval_minutes !== undefined && updates.interval_minutes > 0) {
    query.run('UPDATE job_configs SET interval_minutes = ? WHERE id = ?', [
      updates.interval_minutes,
      jobId
    ]);
    logger.background.info(`${job.name} interval changed to ${updates.interval_minutes} minutes`);
  }

  // Reschedule the job with new config
  scheduleJob(job);

  return true;
}

// Get all jobs with their status
export function getJobsStatus() {
  return jobs.map((job) => {
    const config = ensureJobConfig(job);
    const state = jobStates.get(job.id) || {
      isRunning: false,
      lastRun: null,
      lastResult: null,
      lastError: null,
      nextRun: null
    };

    return {
      id: job.id,
      name: job.name,
      description: job.description,
      enabled: config.enabled === 1,
      intervalMinutes: config.interval_minutes,
      defaultInterval: job.defaultInterval,
      isRunning: state.isRunning,
      lastRun: state.lastRun?.toISOString() || null,
      lastResult: state.lastResult,
      lastError: state.lastError,
      nextRun: state.nextRun?.toISOString() || null
    };
  });
}
