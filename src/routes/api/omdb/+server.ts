import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getOMDBConfig, saveOMDBConfig } from '$lib/server/omdb';

// GET - Get OMDB config (without exposing full API key)
export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const config = getOMDBConfig();

  if (!config) {
    return json({ configured: false });
  }

  return json({
    configured: true,
    enabled: config.enabled === 1,
    // Mask API key for security
    apiKeyMasked: config.api_key ? `${config.api_key.slice(0, 4)}${'*'.repeat(4)}` : null
  });
};

// POST - Save OMDB config
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user || locals.user.role !== 'admin') {
    return json({ error: 'Admin access required' }, { status: 403 });
  }

  const { apiKey, enabled } = await request.json();

  if (!apiKey || typeof apiKey !== 'string') {
    return json({ error: 'API key is required' }, { status: 400 });
  }

  saveOMDBConfig(apiKey, enabled ?? true);

  return json({ success: true });
};
