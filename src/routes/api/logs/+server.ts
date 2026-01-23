import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  queryLogs,
  getLogStats,
  getLogSources,
  pruneLogs,
  clearAllLogs,
  exportLogs,
  type LogLevel,
  type LogQueryOptions
} from '$lib/server/logger';

// GET /api/logs - Query logs with filtering
export const GET: RequestHandler = async ({ locals, url }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (locals.user.role !== 'admin') {
    return json({ error: 'Forbidden' }, { status: 403 });
  }

  const level = url.searchParams.get('level');
  const source = url.searchParams.get('source');
  const search = url.searchParams.get('search');
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');
  const limit = url.searchParams.get('limit');
  const offset = url.searchParams.get('offset');
  const action = url.searchParams.get('action');

  // Special actions
  if (action === 'stats') {
    const stats = getLogStats();
    return json({ stats });
  }

  if (action === 'sources') {
    const sources = getLogSources();
    return json({ sources });
  }

  if (action === 'export') {
    const options: LogQueryOptions = {};
    if (level) options.level = level.split(',') as LogLevel[];
    if (source) options.source = source.split(',');
    if (search) options.search = search;
    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;

    const logs = exportLogs(options);

    return new Response(JSON.stringify(logs, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="fluxarr-logs-${new Date().toISOString().split('T')[0]}.json"`
      }
    });
  }

  // Regular query
  const options: LogQueryOptions = {};
  if (level) options.level = level.split(',') as LogLevel[];
  if (source) options.source = source.split(',');
  if (search) options.search = search;
  if (startDate) options.startDate = startDate;
  if (endDate) options.endDate = endDate;
  if (limit) options.limit = parseInt(limit, 10);
  if (offset) options.offset = parseInt(offset, 10);

  const result = queryLogs(options);
  return json(result);
};

// DELETE /api/logs - Prune or clear logs
export const DELETE: RequestHandler = async ({ locals, url }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (locals.user.role !== 'admin') {
    return json({ error: 'Forbidden' }, { status: 403 });
  }

  const beforeDate = url.searchParams.get('before');
  const clearAll = url.searchParams.get('clearAll');

  if (clearAll === 'true') {
    const deleted = clearAllLogs();
    return json({ deleted, message: `Cleared all ${deleted} logs` });
  }

  if (beforeDate) {
    const deleted = pruneLogs(beforeDate);
    return json({ deleted, message: `Pruned ${deleted} logs before ${beforeDate}` });
  }

  return json({ error: 'Specify "before" date or "clearAll=true"' }, { status: 400 });
};
