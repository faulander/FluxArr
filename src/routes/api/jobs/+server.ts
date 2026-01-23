import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getJobsStatus, updateJobConfig, triggerJob } from '$lib/server/background-jobs';

// GET /api/jobs - Get all jobs status
export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only admins can view jobs
  if (locals.user.role !== 'admin') {
    return json({ error: 'Forbidden' }, { status: 403 });
  }

  const jobs = getJobsStatus();
  return json({ jobs });
};

// PUT /api/jobs - Update job configuration
export const PUT: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (locals.user.role !== 'admin') {
    return json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { jobId, enabled, intervalMinutes } = body;

  if (!jobId) {
    return json({ error: 'Job ID required' }, { status: 400 });
  }

  const success = updateJobConfig(jobId, {
    enabled: enabled !== undefined ? enabled : undefined,
    interval_minutes: intervalMinutes !== undefined ? intervalMinutes : undefined
  });

  if (!success) {
    return json({ error: 'Job not found' }, { status: 404 });
  }

  const jobs = getJobsStatus();
  return json({ jobs });
};

// POST /api/jobs - Trigger a job manually
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (locals.user.role !== 'admin') {
    return json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { jobId } = body;

  if (!jobId) {
    return json({ error: 'Job ID required' }, { status: 400 });
  }

  const success = await triggerJob(jobId);

  if (!success) {
    return json({ error: 'Job not found' }, { status: 404 });
  }

  const jobs = getJobsStatus();
  return json({ jobs });
};
