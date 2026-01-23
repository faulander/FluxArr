import type { Handle, HandleServerError } from '@sveltejs/kit';
import { getSession } from '$lib/server/auth';
import { migrate } from '$lib/server/db';
import { startBackgroundJobs } from '$lib/server/background-jobs';
import { logger } from '$lib/server/logger';

// Run migrations on startup, then start background jobs
let migrationsSucceeded = false;
try {
  migrate();
  logger.db.info('Database migrations complete');
  migrationsSucceeded = true;
} catch (error) {
  logger.db.error('Migration failed', { error: String(error) });
  console.error('FATAL: Database migrations failed. Background jobs will not start.');
}

// Only start background jobs if migrations succeeded
if (migrationsSucceeded) {
  startBackgroundJobs();
}

export const handle: Handle = async ({ event, resolve }) => {
  const start = performance.now();

  // Get session from cookie
  const sessionId = event.cookies.get('session');

  if (sessionId) {
    const sessionData = getSession(sessionId);
    if (sessionData) {
      event.locals.user = sessionData.user;
      event.locals.session = {
        id: sessionData.id,
        user_id: sessionData.user_id,
        expires_at: sessionData.expires_at,
        created_at: sessionData.created_at
      };
    } else {
      // Invalid or expired session - clear cookie
      event.cookies.delete('session', { path: '/' });
    }
  }

  const response = await resolve(event);

  // Log request
  const duration = Math.round(performance.now() - start);
  const user = event.locals.user?.email || 'anonymous';

  // Only log non-static requests to reduce noise
  if (!event.url.pathname.startsWith('/_app/') && !event.url.pathname.startsWith('/favicon')) {
    logger.http.info(`${event.request.method} ${event.url.pathname} - ${response.status}`, {
      method: event.request.method,
      path: event.url.pathname,
      status: response.status,
      duration,
      user
    });
  }

  return response;
};

export const handleError: HandleServerError = async ({ error, event, status, message }) => {
  logger.http.error(`Server error: ${message}`, {
    status,
    message,
    path: event.url.pathname,
    error: error instanceof Error ? error.message : String(error)
  });

  return {
    message: status === 404 ? 'Page not found' : 'An unexpected error occurred'
  };
};
