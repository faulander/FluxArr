import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
  // If already logged in, redirect to shows
  if (locals.user) {
    const redirectTo = url.searchParams.get('redirect') || '/shows';
    throw redirect(303, redirectTo);
  }

  return {};
};
