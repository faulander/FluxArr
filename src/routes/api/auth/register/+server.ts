import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createUser, getUserByEmail, hasUsers, createSession } from '$lib/server/auth';

export const POST: RequestHandler = async ({ request, cookies }) => {
  const { email, password, name } = await request.json();

  if (!email || !password || !name) {
    return json({ error: 'Email, password, and name are required' }, { status: 400 });
  }

  if (password.length < 8) {
    return json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  // Check if email already exists
  const existing = getUserByEmail(email);
  if (existing) {
    return json({ error: 'Email already registered' }, { status: 400 });
  }

  try {
    // First user becomes admin
    const isFirstUser = !hasUsers();

    const user = await createUser({
      email,
      password,
      name,
      role: isFirstUser ? 'admin' : 'user'
    });

    // Auto-login after registration
    const session = createSession(user.id);

    cookies.set('session', session.id, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    });

    return json({ user, isFirstUser });
  } catch (error) {
    console.error('Registration error:', error);
    return json({ error: 'Failed to create account' }, { status: 500 });
  }
};
