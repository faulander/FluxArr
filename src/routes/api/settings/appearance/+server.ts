import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserSettings, saveUserSettings } from '$lib/server/user-settings';

// GET - Fetch user appearance settings
export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const settings = getUserSettings(locals.user.id);

  return json({
    primaryColorLight: settings?.primary_color_light || '#000000',
    primaryColorDark: settings?.primary_color_dark || '#ffffff'
  });
};

// POST - Save user appearance settings
export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { primaryColorLight, primaryColorDark } = body;

    // Validate hex color format
    const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

    if (primaryColorLight && !hexColorRegex.test(primaryColorLight)) {
      return json({ error: 'Invalid light mode color format' }, { status: 400 });
    }

    if (primaryColorDark && !hexColorRegex.test(primaryColorDark)) {
      return json({ error: 'Invalid dark mode color format' }, { status: 400 });
    }

    const settings = saveUserSettings(locals.user.id, {
      primaryColorLight,
      primaryColorDark
    });

    return json({
      primaryColorLight: settings.primary_color_light,
      primaryColorDark: settings.primary_color_dark
    });
  } catch (error) {
    console.error('Error saving appearance settings:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return json({ error: `Failed to save settings: ${message}` }, { status: 400 });
  }
};
