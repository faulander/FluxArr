import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteSession } from '$lib/server/auth';

export const POST: RequestHandler = async ({ cookies, locals }) => {
  const sessionId = cookies.get('session');

  if (sessionId) {
    deleteSession(sessionId);
  }

  cookies.delete('session', { path: '/' });

  return json({ success: true });
};
