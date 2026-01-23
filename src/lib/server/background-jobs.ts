import { syncAllSonarrLibraries } from './sonarr';

let sonarrSyncInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

const SONARR_SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

async function runSonarrSync() {
  if (isRunning) {
    console.log('[Background] Sonarr sync already running, skipping...');
    return;
  }

  isRunning = true;
  console.log('[Background] Starting Sonarr library sync...');

  try {
    const results = await syncAllSonarrLibraries();
    const total = results.reduce((sum, r) => sum + r.count, 0);
    console.log(`[Background] Sonarr sync complete. ${results.length} configs, ${total} total series.`);
  } catch (error) {
    console.error('[Background] Sonarr sync failed:', error);
  } finally {
    isRunning = false;
  }
}

export function startBackgroundJobs() {
  if (sonarrSyncInterval) {
    console.log('[Background] Jobs already running');
    return;
  }

  console.log('[Background] Starting background jobs...');

  // Run immediately on startup
  runSonarrSync();

  // Then run every 5 minutes
  sonarrSyncInterval = setInterval(runSonarrSync, SONARR_SYNC_INTERVAL);

  console.log(`[Background] Sonarr library sync scheduled every ${SONARR_SYNC_INTERVAL / 1000}s`);
}

export function stopBackgroundJobs() {
  if (sonarrSyncInterval) {
    clearInterval(sonarrSyncInterval);
    sonarrSyncInterval = null;
    console.log('[Background] Background jobs stopped');
  }
}

// Manual trigger for immediate sync
export async function triggerSonarrSync() {
  await runSonarrSync();
}
