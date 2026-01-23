import { syncAllSonarrLibraries } from './sonarr';
import { runIncrementalSync } from './tvmaze-sync';
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

function scheduleJob(job: JobDefinition) {
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

  // Run immediately on startup
  runJob(job);

  // Schedule recurring
  state.interval = setInterval(() => runJob(job), intervalMs);
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
