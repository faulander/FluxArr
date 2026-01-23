import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { query } from '$lib/server/db';
import type { SavedFilter } from '$lib/types/filter';

// GET - List all filters for the current user
export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const filters = query.all<SavedFilter>(
    `SELECT * FROM filters WHERE user_id = ? ORDER BY is_default DESC, name ASC`,
    [locals.user.id]
  );

  return json({ filters });
};

// POST - Create a new filter
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { name, config, isDefault } = await request.json();

  if (!name || !config) {
    return json({ error: 'Name and config are required' }, { status: 400 });
  }

  // If setting as default, unset other defaults
  if (isDefault) {
    query.run(`UPDATE filters SET is_default = 0 WHERE user_id = ?`, [locals.user.id]);
  }

  const result = query.run(
    `INSERT INTO filters (user_id, name, config, is_default) VALUES (?, ?, ?, ?)`,
    [locals.user.id, name, JSON.stringify(config), isDefault ? 1 : 0]
  );

  const filter = query.get<SavedFilter>(`SELECT * FROM filters WHERE id = ?`, [
    result.lastInsertRowid
  ]);

  return json({ filter }, { status: 201 });
};
