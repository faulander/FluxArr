import type { PageServerLoad } from './$types';
import { getUserSonarrConfigs } from '$lib/server/sonarr';
import { getOMDBConfig } from '$lib/server/omdb';
import { getUserSettings } from '$lib/server/user-settings';

export const load: PageServerLoad = async ({ locals }) => {
  const sonarrConfigs = getUserSonarrConfigs(locals.user!.id);
  const userSettings = getUserSettings(locals.user!.id);

  // Don't expose API keys
  const safeConfigs = sonarrConfigs.map((c) => ({
    id: c.id,
    user_id: c.user_id,
    name: c.name,
    url: c.url,
    is_default: c.is_default,
    created_at: c.created_at,
    isShared: c.user_id === null
  }));

  // Get OMDB config (mask API key)
  const omdbConfigRaw = getOMDBConfig();
  const omdbConfig = omdbConfigRaw
    ? {
        configured: true,
        enabled: omdbConfigRaw.enabled === 1,
        premium: omdbConfigRaw.premium === 1,
        apiKeyMasked: omdbConfigRaw.api_key
          ? `${omdbConfigRaw.api_key.slice(0, 4)}${'*'.repeat(4)}`
          : null
      }
    : { configured: false, enabled: false, premium: false, apiKeyMasked: null };

  return {
    sonarrConfigs: safeConfigs,
    omdbConfig,
    userSettings: userSettings
      ? {
          primaryColorLight: userSettings.primary_color_light,
          primaryColorDark: userSettings.primary_color_dark
        }
      : null
  };
};
