import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { login } from '$lib/server/auth';

export const POST: RequestHandler = async ({ request, cookies }) => {
  const { email, password } = await request.json();

  if (!email || !password) {
    return json({ error: 'Email and password are required' }, { status: 400 });
  }

  const result = await login(email, password);

  if (!result) {
    return json({ error: 'Invalid email or password' }, { status: 401 });
  }

  // Set session cookie
  // Note: secure should be true in production with HTTPS
  // Set COOKIE_SECURE=false env var to disable for HTTP-only setups
  cookies.set('session', result.session.id, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false',
    maxAge: 60 * 60 * 24 * 30 // 30 days
  });

  return json({ user: result.user });
};
