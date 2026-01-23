<script lang="ts">
  import { onMount } from 'svelte';
  import { toast } from 'svelte-sonner';
  import {
    Clock,
    Play,
    Pause,
    RefreshCw,
    CheckCircle,
    XCircle,
    Loader2,
    Timer
  } from '@lucide/svelte';
  import * as Card from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Badge } from '$lib/components/ui/badge';

  interface Job {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    intervalMinutes: number;
    defaultInterval: number;
    isRunning: boolean;
    lastRun: string | null;
    lastResult: 'success' | 'error' | null;
    lastError: string | null;
    nextRun: string | null;
  }

  let jobs = $state<Job[]>([]);
  let isLoading = $state(true);
  let runningJobId = $state<string | null>(null);
  let savingJobId = $state<string | null>(null);
  let editingIntervals = $state<Record<string, number>>({});

  async function loadJobs() {
    try {
      const response = await fetch('/api/jobs');
      if (!response.ok) throw new Error('Failed to load jobs');
      const data = await response.json();
      jobs = data.jobs;
      // Initialize editing intervals
      editingIntervals = {};
      for (const job of jobs) {
        editingIntervals[job.id] = job.intervalMinutes;
      }
    } catch (error) {
      toast.error('Failed to load background jobs');
    } finally {
      isLoading = false;
    }
  }

  async function toggleJob(jobId: string, enabled: boolean) {
    savingJobId = jobId;
    try {
      const response = await fetch('/api/jobs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, enabled })
      });

      if (!response.ok) throw new Error('Failed to update job');

      const data = await response.json();
      jobs = data.jobs;
      toast.success(enabled ? 'Job enabled' : 'Job disabled');
    } catch {
      toast.error('Failed to update job');
    } finally {
      savingJobId = null;
    }
  }

  async function updateInterval(jobId: string) {
    const newInterval = editingIntervals[jobId];
    if (!newInterval || newInterval < 1) {
      toast.error('Interval must be at least 1 minute');
      return;
    }

    savingJobId = jobId;
    try {
      const response = await fetch('/api/jobs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, intervalMinutes: newInterval })
      });

      if (!response.ok) throw new Error('Failed to update interval');

      const data = await response.json();
      jobs = data.jobs;
      toast.success('Interval updated');
    } catch {
      toast.error('Failed to update interval');
    } finally {
      savingJobId = null;
    }
  }

  async function runJob(jobId: string) {
    runningJobId = jobId;
    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId })
      });

      if (!response.ok) throw new Error('Failed to run job');

      const data = await response.json();
      jobs = data.jobs;
      toast.success('Job started');
    } catch {
      toast.error('Failed to run job');
    } finally {
      runningJobId = null;
    }
  }

  function formatDate(dateString: string | null): string {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString();
  }

  function formatRelativeTime(dateString: string | null): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / 60000);

    if (diffMins < 0) return 'overdue';
    if (diffMins === 0) return 'now';
    if (diffMins === 1) return 'in 1 minute';
    return `in ${diffMins} minutes`;
  }

  onMount(() => {
    loadJobs();
  });
</script>

<Card.Root>
  <Card.Header>
    <div class="flex items-center justify-between">
      <div>
        <Card.Title class="flex items-center gap-2">
          <Clock class="w-5 h-5" />
          Background Jobs
        </Card.Title>
        <Card.Description>Manage scheduled background tasks</Card.Description>
      </div>
      <Button variant="outline" size="sm" onclick={loadJobs} disabled={isLoading}>
        <RefreshCw class="w-4 h-4 mr-2 {isLoading ? 'animate-spin' : ''}" />
        Refresh
      </Button>
    </div>
  </Card.Header>
  <Card.Content>
    {#if isLoading}
      <div class="flex items-center justify-center py-8">
        <Loader2 class="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    {:else if jobs.length === 0}
      <div class="text-center py-6 text-muted-foreground">
        <Clock class="w-10 h-10 mx-auto mb-2 opacity-50" />
        <p class="text-sm">No background jobs configured</p>
      </div>
    {:else}
      <div class="space-y-4">
        {#each jobs as job (job.id)}
          <div class="rounded-lg border bg-card p-4 space-y-4">
            <div class="flex items-start justify-between gap-4">
              <div class="space-y-1">
                <div class="flex items-center gap-2">
                  <h3 class="font-medium">{job.name}</h3>
                  {#if job.isRunning}
                    <Badge variant="default" class="text-xs">
                      <Loader2 class="w-3 h-3 mr-1 animate-spin" />
                      Running
                    </Badge>
                  {:else if job.enabled}
                    <Badge variant="secondary" class="text-xs">Active</Badge>
                  {:else}
                    <Badge variant="outline" class="text-xs">Disabled</Badge>
                  {/if}
                </div>
                <p class="text-sm text-muted-foreground">{job.description}</p>
              </div>

              <div class="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onclick={() => runJob(job.id)}
                  disabled={job.isRunning || runningJobId === job.id}
                >
                  {#if runningJobId === job.id}
                    <Loader2 class="w-4 h-4 mr-2 animate-spin" />
                  {:else}
                    <Play class="w-4 h-4 mr-2" />
                  {/if}
                  Run Now
                </Button>
                <Button
                  variant={job.enabled ? 'secondary' : 'default'}
                  size="sm"
                  onclick={() => toggleJob(job.id, !job.enabled)}
                  disabled={savingJobId === job.id}
                >
                  {#if savingJobId === job.id}
                    <Loader2 class="w-4 h-4" />
                  {:else if job.enabled}
                    <Pause class="w-4 h-4" />
                  {:else}
                    <Play class="w-4 h-4" />
                  {/if}
                </Button>
              </div>
            </div>

            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div class="space-y-1">
                <Label class="text-muted-foreground text-xs">Last Run</Label>
                <div class="flex items-center gap-1.5">
                  {#if job.lastResult === 'success'}
                    <CheckCircle class="w-3.5 h-3.5 text-green-500" />
                  {:else if job.lastResult === 'error'}
                    <XCircle class="w-3.5 h-3.5 text-red-500" />
                  {/if}
                  <span class="font-medium">{formatDate(job.lastRun)}</span>
                </div>
                {#if job.lastError}
                  <p class="text-xs text-red-500 truncate" title={job.lastError}>
                    {job.lastError}
                  </p>
                {/if}
              </div>

              <div class="space-y-1">
                <Label class="text-muted-foreground text-xs">Next Run</Label>
                <div class="flex items-center gap-1.5">
                  <Timer class="w-3.5 h-3.5 text-muted-foreground" />
                  <span class="font-medium">
                    {job.enabled ? formatRelativeTime(job.nextRun) : 'Disabled'}
                  </span>
                </div>
              </div>

              <div class="space-y-1 col-span-2 md:col-span-2">
                <Label class="text-muted-foreground text-xs">Interval (minutes)</Label>
                <div class="flex items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    class="w-24 h-8"
                    bind:value={editingIntervals[job.id]}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onclick={() => updateInterval(job.id)}
                    disabled={savingJobId === job.id ||
                      editingIntervals[job.id] === job.intervalMinutes}
                  >
                    {#if savingJobId === job.id}
                      <Loader2 class="w-4 h-4 animate-spin" />
                    {:else}
                      Save
                    {/if}
                  </Button>
                  {#if editingIntervals[job.id] !== job.defaultInterval}
                    <button
                      class="text-xs text-muted-foreground hover:text-foreground"
                      onclick={() => (editingIntervals[job.id] = job.defaultInterval)}
                    >
                      Reset to {job.defaultInterval}m
                    </button>
                  {/if}
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </Card.Content>
</Card.Root>
