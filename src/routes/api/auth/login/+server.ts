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
  cookies.set('session', result.session.id, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30 // 30 days
  });

  return json({ user: result.user });
};
