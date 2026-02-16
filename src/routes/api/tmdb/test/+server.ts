import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { testTMDBConnection } from '$lib/server/tmdb';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user || locals.user.role !== 'admin') {
    return json({ error: 'Admin access required' }, { status: 403 });
  }

  const { apiKey } = await request.json();

  if (!apiKey || typeof apiKey !== 'string') {
    return json({ error: 'API key is required' }, { status: 400 });
  }

  const result = await testTMDBConnection(apiKey);

  return json(result);
};
