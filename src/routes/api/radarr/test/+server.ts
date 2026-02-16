import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { radarr, getRadarrConfig } from '$lib/server/radarr';

// POST - Test Radarr connection
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { configId, url, apiKey } = await request.json();

  // Either test an existing config or test new credentials
  if (configId) {
    const config = getRadarrConfig(configId, locals.user.id);
    if (!config) {
      return json({ error: 'Configuration not found' }, { status: 404 });
    }

    const result = await radarr.testConnection(config);
    return json(result);
  }

  if (!url || !apiKey) {
    return json({ error: 'URL and API key are required' }, { status: 400 });
  }

  // Test with provided credentials
  const testConfig = {
    id: 0,
    user_id: locals.user.id,
    name: 'Test',
    url,
    api_key: apiKey,
    is_default: 0,
    last_library_sync: null,
    created_at: ''
  };

  const result = await radarr.testConnection(testConfig);
  return json(result);
};
