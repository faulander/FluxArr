import type { Handle, HandleServerError } from '@sveltejs/kit';
import { getSession } from '$lib/server/auth';
import { migrate } from '$lib/server/db';
import { startBackgroundJobs } from '$lib/server/background-jobs';

// Run migrations on startup
try {
  migrate();
  console.log('Database migrations complete');
} catch (error) {
  console.error('Migration failed:', error);
}

// Start background jobs (Sonarr library sync, etc.)
startBackgroundJobs();

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
  const duration = (performance.now() - start).toFixed(2);
  const user = event.locals.user ? `[${event.locals.user.email}]` : '[anonymous]';
  console.log(
    `${event.request.method} ${event.url.pathname} - ${response.status} (${duration}ms) ${user}`
  );

  return response;
};

export const handleError: HandleServerError = async ({ error, event, status, message }) => {
  console.error('Server error:', {
    status,
    message,
    path: event.url.pathname,
    error
  });

  return {
    message: status === 404 ? 'Page not found' : 'An unexpected error occurred'
  };
};
