import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { query } from '$lib/server/db';
import type { SavedFilter } from '$lib/types/filter';

// GET - Get a single filter
export const GET: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const filter = query.get<SavedFilter>(`SELECT * FROM filters WHERE id = ? AND user_id = ?`, [
    params.id,
    locals.user.id
  ]);

  if (!filter) {
    return json({ error: 'Filter not found' }, { status: 404 });
  }

  return json({ filter });
};

// PUT - Update a filter
export const PUT: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const existing = query.get<SavedFilter>(`SELECT * FROM filters WHERE id = ? AND user_id = ?`, [
    params.id,
    locals.user.id
  ]);

  if (!existing) {
    return json({ error: 'Filter not found' }, { status: 404 });
  }

  const { name, config, isDefault } = await request.json();

  const updates: string[] = [];
  const values: unknown[] = [];

  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name);
  }

  if (config !== undefined) {
    updates.push('config = ?');
    values.push(JSON.stringify(config));
  }

  if (isDefault !== undefined) {
    // If setting as default, unset other defaults for the same content_type first
    if (isDefault) {
      query.run(`UPDATE filters SET is_default = 0 WHERE user_id = ? AND content_type = ?`, [
        locals.user.id,
        existing.content_type || 'show'
      ]);
    }
    updates.push('is_default = ?');
    values.push(isDefault ? 1 : 0);
  }

  if (updates.length > 0) {
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(params.id);
    query.run(`UPDATE filters SET ${updates.join(', ')} WHERE id = ?`, values);
  }

  const filter = query.get<SavedFilter>(`SELECT * FROM filters WHERE id = ?`, [params.id]);

  return json({ filter });
};

// DELETE - Delete a filter
export const DELETE: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const existing = query.get<SavedFilter>(`SELECT * FROM filters WHERE id = ? AND user_id = ?`, [
    params.id,
    locals.user.id
  ]);

  if (!existing) {
    return json({ error: 'Filter not found' }, { status: 404 });
  }

  query.run(`DELETE FROM filters WHERE id = ?`, [params.id]);

  return json({ success: true });
};
