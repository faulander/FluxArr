import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  getUserSonarrConfigs,
  createSonarrConfig,
  updateSonarrConfig,
  deleteSonarrConfig,
  getSonarrConfig
} from '$lib/server/sonarr';

// GET - List user's Sonarr configs
export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const configs = getUserSonarrConfigs(locals.user.id);

  // Don't expose API keys in the list
  const safeConfigs = configs.map((c) => ({
    id: c.id,
    user_id: c.user_id,
    name: c.name,
    url: c.url,
    is_default: c.is_default,
    created_at: c.created_at
  }));

  return json({ configs: safeConfigs });
};

// POST - Create new Sonarr config
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { name, url, apiKey, isDefault, shared } = await request.json();

  if (!name || !url || !apiKey) {
    return json({ error: 'Name, URL, and API key are required' }, { status: 400 });
  }

  // Only admins can create shared configs
  const userId = shared && locals.user.role === 'admin' ? null : locals.user.id;

  try {
    const config = createSonarrConfig(userId, name, url, apiKey, isDefault);

    return json({
      config: {
        id: config.id,
        user_id: config.user_id,
        name: config.name,
        url: config.url,
        is_default: config.is_default,
        created_at: config.created_at
      }
    });
  } catch (error) {
    console.error('Failed to create Sonarr config:', error);
    return json({ error: 'Failed to create configuration' }, { status: 500 });
  }
};

// PUT - Update Sonarr config
export const PUT: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, name, url, apiKey, isDefault } = await request.json();

  if (!id) {
    return json({ error: 'Config ID is required' }, { status: 400 });
  }

  const config = updateSonarrConfig(id, locals.user.id, { name, url, apiKey, isDefault });

  if (!config) {
    return json({ error: 'Configuration not found or access denied' }, { status: 404 });
  }

  return json({
    config: {
      id: config.id,
      user_id: config.user_id,
      name: config.name,
      url: config.url,
      is_default: config.is_default,
      created_at: config.created_at
    }
  });
};

// DELETE - Delete Sonarr config
export const DELETE: RequestHandler = async ({ url, locals }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = parseInt(url.searchParams.get('id') || '', 10);

  if (isNaN(id)) {
    return json({ error: 'Valid config ID is required' }, { status: 400 });
  }

  const deleted = deleteSonarrConfig(id, locals.user.id);

  if (!deleted) {
    return json({ error: 'Configuration not found or access denied' }, { status: 404 });
  }

  return json({ success: true });
};
