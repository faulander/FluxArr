import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { getUserSettings } from '$lib/server/user-settings';

export const load: LayoutServerLoad = async ({ locals, url }) => {
  if (!locals.user) {
    throw redirect(303, `/login?redirect=${encodeURIComponent(url.pathname)}`);
  }

  const userSettings = getUserSettings(locals.user.id);

  return {
    user: locals.user,
    userSettings: userSettings
      ? {
          primaryColorLight: userSettings.primary_color_light,
          primaryColorDark: userSettings.primary_color_dark
        }
      : null
  };
};
