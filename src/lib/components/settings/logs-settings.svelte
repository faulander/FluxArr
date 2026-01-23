<script lang="ts">
  import { onMount } from 'svelte';
  import { toast } from 'svelte-sonner';
  import {
    FileText,
    RefreshCw,
    Download,
    Trash2,
    Filter,
    AlertCircle,
    AlertTriangle,
    Info,
    Bug,
    Loader2,
    ChevronLeft,
    ChevronRight,
    X
  } from '@lucide/svelte';
  import * as Card from '$lib/components/ui/card';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as Select from '$lib/components/ui/select';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Badge } from '$lib/components/ui/badge';
  import { cn } from '$lib/utils';

  type LogLevel = 'debug' | 'info' | 'warn' | 'error';

  interface LogEntry {
    id: number;
    timestamp: string;
    level: LogLevel;
    source: string;
    message: string;
    details: Record<string, unknown> | null;
  }

  interface LogStats {
    total: number;
    byLevel: Record<LogLevel, number>;
    bySource: Record<string, number>;
    oldestLog: string | null;
    newestLog: string | null;
  }

  let logs = $state<LogEntry[]>([]);
  let total = $state(0);
  let stats = $state<LogStats | null>(null);
  let sources = $state<string[]>([]);
  let isLoading = $state(true);
  let isExporting = $state(false);
  let isPruning = $state(false);

  // Filters
  let selectedLevels = $state<LogLevel[]>([]);
  let selectedSource = $state<string>('');
  let searchQuery = $state('');

  // Pagination
  let page = $state(1);
  let pageSize = $state(50);
  let totalPages = $derived(Math.ceil(total / pageSize));

  // Dialogs
  let pruneDialogOpen = $state(false);
  let pruneDays = $state(7);
  let detailsDialogOpen = $state(false);
  let selectedLog = $state<LogEntry | null>(null);

  const levelConfig: Record<LogLevel, { icon: typeof Info; color: string; bgColor: string }> = {
    debug: { icon: Bug, color: 'text-gray-500', bgColor: 'bg-gray-500/10' },
    info: { icon: Info, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
    warn: { icon: AlertTriangle, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10' },
    error: { icon: AlertCircle, color: 'text-red-500', bgColor: 'bg-red-500/10' }
  };

  async function loadLogs() {
    isLoading = true;
    try {
      const params = new URLSearchParams();
      if (selectedLevels.length > 0) params.set('level', selectedLevels.join(','));
      if (selectedSource) params.set('source', selectedSource);
      if (searchQuery) params.set('search', searchQuery);
      params.set('limit', pageSize.toString());
      params.set('offset', ((page - 1) * pageSize).toString());

      const response = await fetch(`/api/logs?${params}`);
      if (!response.ok) throw new Error('Failed to load logs');

      const data = await response.json();
      logs = data.logs;
      total = data.total;
    } catch {
      toast.error('Failed to load logs');
    } finally {
      isLoading = false;
    }
  }

  async function loadStats() {
    try {
      const response = await fetch('/api/logs?action=stats');
      if (!response.ok) throw new Error('Failed to load stats');
      const data = await response.json();
      stats = data.stats;
    } catch {
      console.error('Failed to load log stats');
    }
  }

  async function loadSources() {
    try {
      const response = await fetch('/api/logs?action=sources');
      if (!response.ok) throw new Error('Failed to load sources');
      const data = await response.json();
      sources = data.sources;
    } catch {
      console.error('Failed to load log sources');
    }
  }

  async function exportLogs() {
    isExporting = true;
    try {
      const params = new URLSearchParams();
      params.set('action', 'export');
      if (selectedLevels.length > 0) params.set('level', selectedLevels.join(','));
      if (selectedSource) params.set('source', selectedSource);
      if (searchQuery) params.set('search', searchQuery);

      const response = await fetch(`/api/logs?${params}`);
      if (!response.ok) throw new Error('Failed to export logs');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fluxarr-logs-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success('Logs exported successfully');
    } catch {
      toast.error('Failed to export logs');
    } finally {
      isExporting = false;
    }
  }

  async function pruneLogs() {
    isPruning = true;
    try {
      const beforeDate = new Date();
      beforeDate.setDate(beforeDate.getDate() - pruneDays);

      const response = await fetch(`/api/logs?before=${beforeDate.toISOString()}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to prune logs');

      const data = await response.json();
      toast.success(data.message);

      pruneDialogOpen = false;
      await Promise.all([loadLogs(), loadStats()]);
    } catch {
      toast.error('Failed to prune logs');
    } finally {
      isPruning = false;
    }
  }

  async function clearAllLogs() {
    isPruning = true;
    try {
      const response = await fetch('/api/logs?clearAll=true', {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to clear logs');

      const data = await response.json();
      toast.success(data.message);

      pruneDialogOpen = false;
      await Promise.all([loadLogs(), loadStats()]);
    } catch {
      toast.error('Failed to clear logs');
    } finally {
      isPruning = false;
    }
  }

  function toggleLevel(level: LogLevel) {
    if (selectedLevels.includes(level)) {
      selectedLevels = selectedLevels.filter((l) => l !== level);
    } else {
      selectedLevels = [...selectedLevels, level];
    }
    page = 1;
    loadLogs();
  }

  function clearFilters() {
    selectedLevels = [];
    selectedSource = '';
    searchQuery = '';
    page = 1;
    loadLogs();
  }

  function formatTimestamp(timestamp: string): string {
    return new Date(timestamp).toLocaleString();
  }

  function showDetails(log: LogEntry) {
    selectedLog = log;
    detailsDialogOpen = true;
  }

  function handleSourceChange(value: string | undefined) {
    selectedSource = value || '';
    page = 1;
    loadLogs();
  }

  function handleSearch() {
    page = 1;
    loadLogs();
  }

  onMount(() => {
    Promise.all([loadLogs(), loadStats(), loadSources()]);
  });
</script>

<div class="space-y-6">
  <!-- Stats Card -->
  {#if stats}
    <Card.Root>
      <Card.Header class="pb-3">
        <Card.Title class="flex items-center gap-2 text-base">
          <FileText class="w-4 h-4" />
          Log Statistics
        </Card.Title>
      </Card.Header>
      <Card.Content>
        <div class="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <div>
            <p class="text-muted-foreground text-xs">Total</p>
            <p class="text-xl font-semibold">{stats.total.toLocaleString()}</p>
          </div>
          <div>
            <p class="text-muted-foreground text-xs">Errors</p>
            <p class="text-xl font-semibold text-red-500">{stats.byLevel.error}</p>
          </div>
          <div>
            <p class="text-muted-foreground text-xs">Warnings</p>
            <p class="text-xl font-semibold text-yellow-500">{stats.byLevel.warn}</p>
          </div>
          <div>
            <p class="text-muted-foreground text-xs">Info</p>
            <p class="text-xl font-semibold text-blue-500">{stats.byLevel.info}</p>
          </div>
          <div>
            <p class="text-muted-foreground text-xs">Debug</p>
            <p class="text-xl font-semibold text-gray-500">{stats.byLevel.debug}</p>
          </div>
        </div>
      </Card.Content>
    </Card.Root>
  {/if}

  <!-- Main Logs Card -->
  <Card.Root>
    <Card.Header>
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Card.Title class="flex items-center gap-2">
            <FileText class="w-5 h-5" />
            Application Logs
          </Card.Title>
          <Card.Description>View and manage application logs</Card.Description>
        </div>
        <div class="flex items-center gap-2">
          <Button variant="outline" size="sm" onclick={() => loadLogs()} disabled={isLoading}>
            <RefreshCw class="w-4 h-4 mr-2 {isLoading ? 'animate-spin' : ''}" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onclick={exportLogs} disabled={isExporting}>
            {#if isExporting}
              <Loader2 class="w-4 h-4 mr-2 animate-spin" />
            {:else}
              <Download class="w-4 h-4 mr-2" />
            {/if}
            Export
          </Button>
          <Dialog.Root bind:open={pruneDialogOpen}>
            <Dialog.Trigger>
              {#snippet child({ props })}
                <Button {...props} variant="outline" size="sm">
                  <Trash2 class="w-4 h-4 mr-2" />
                  Prune
                </Button>
              {/snippet}
            </Dialog.Trigger>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Prune Logs</Dialog.Title>
                <Dialog.Description>
                  Delete old logs to free up space. This action cannot be undone.
                </Dialog.Description>
              </Dialog.Header>
              <div class="space-y-4 py-4">
                <div class="space-y-2">
                  <Label>Delete logs older than</Label>
                  <div class="flex items-center gap-2">
                    <Input type="number" min="1" class="w-24" bind:value={pruneDays} />
                    <span class="text-sm text-muted-foreground">days</span>
                  </div>
                </div>
              </div>
              <Dialog.Footer class="flex-col sm:flex-row gap-2">
                <Button
                  variant="destructive"
                  onclick={clearAllLogs}
                  disabled={isPruning}
                  class="w-full sm:w-auto"
                >
                  {#if isPruning}
                    <Loader2 class="w-4 h-4 mr-2 animate-spin" />
                  {/if}
                  Clear All Logs
                </Button>
                <Button onclick={pruneLogs} disabled={isPruning} class="w-full sm:w-auto">
                  {#if isPruning}
                    <Loader2 class="w-4 h-4 mr-2 animate-spin" />
                  {/if}
                  Prune Old Logs
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Root>
        </div>
      </div>
    </Card.Header>
    <Card.Content class="space-y-4">
      <!-- Filters -->
      <div class="flex flex-wrap items-center gap-3 p-3 rounded-lg border bg-muted/30">
        <Filter class="w-4 h-4 text-muted-foreground" />

        <!-- Level toggles -->
        <div class="flex items-center gap-1">
          {#each ['error', 'warn', 'info', 'debug'] as LogLevel[] as level}
            {@const config = levelConfig[level]}
            <button
              onclick={() => toggleLevel(level)}
              class={cn(
                'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors',
                selectedLevels.includes(level)
                  ? `${config.bgColor} ${config.color}`
                  : 'bg-background hover:bg-muted text-muted-foreground'
              )}
            >
              <config.icon class="w-3 h-3" />
              {level}
            </button>
          {/each}
        </div>

        <!-- Source filter -->
        <Select.Root type="single" onValueChange={handleSourceChange}>
          <Select.Trigger class="w-36 h-8">
            {selectedSource || 'All sources'}
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="">All sources</Select.Item>
            {#each sources as source (source)}
              <Select.Item value={source}>{source}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>

        <!-- Search -->
        <div class="flex items-center gap-2">
          <Input
            type="text"
            placeholder="Search messages..."
            class="w-48 h-8"
            bind:value={searchQuery}
            onkeydown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button variant="ghost" size="sm" onclick={handleSearch}>Search</Button>
        </div>

        {#if selectedLevels.length > 0 || selectedSource || searchQuery}
          <Button variant="ghost" size="sm" onclick={clearFilters}>
            <X class="w-4 h-4 mr-1" />
            Clear
          </Button>
        {/if}
      </div>

      <!-- Logs Table -->
      {#if isLoading}
        <div class="flex items-center justify-center py-12">
          <Loader2 class="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      {:else if logs.length === 0}
        <div class="text-center py-12 text-muted-foreground">
          <FileText class="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p class="text-sm">No logs found</p>
          {#if selectedLevels.length > 0 || selectedSource || searchQuery}
            <p class="text-xs mt-1">Try adjusting your filters</p>
          {/if}
        </div>
      {:else}
        <div class="border rounded-lg overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-muted/50">
                <tr>
                  <th class="px-3 py-2 text-left font-medium w-40">Timestamp</th>
                  <th class="px-3 py-2 text-left font-medium w-20">Level</th>
                  <th class="px-3 py-2 text-left font-medium w-28">Source</th>
                  <th class="px-3 py-2 text-left font-medium">Message</th>
                </tr>
              </thead>
              <tbody class="divide-y">
                {#each logs as log (log.id)}
                  {@const config = levelConfig[log.level]}
                  <tr
                    class="hover:bg-muted/30 cursor-pointer transition-colors"
                    onclick={() => showDetails(log)}
                  >
                    <td class="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td class="px-3 py-2">
                      <Badge variant="outline" class={cn('text-xs', config.color, config.bgColor)}>
                        <config.icon class="w-3 h-3 mr-1" />
                        {log.level}
                      </Badge>
                    </td>
                    <td class="px-3 py-2">
                      <span class="font-mono text-xs">{log.source}</span>
                    </td>
                    <td class="px-3 py-2 truncate max-w-md" title={log.message}>
                      {log.message}
                      {#if log.details}
                        <Badge variant="outline" class="ml-2 text-xs">+details</Badge>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Pagination -->
        <div class="flex items-center justify-between">
          <p class="text-sm text-muted-foreground">
            Showing {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} of {total} logs
          </p>
          <div class="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onclick={() => {
                page--;
                loadLogs();
              }}
              disabled={page <= 1}
            >
              <ChevronLeft class="w-4 h-4" />
            </Button>
            <span class="text-sm">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onclick={() => {
                page++;
                loadLogs();
              }}
              disabled={page >= totalPages}
            >
              <ChevronRight class="w-4 h-4" />
            </Button>
          </div>
        </div>
      {/if}
    </Card.Content>
  </Card.Root>
</div>

<!-- Log Details Dialog -->
<Dialog.Root bind:open={detailsDialogOpen}>
  <Dialog.Content class="max-w-2xl">
    <Dialog.Header>
      <Dialog.Title>Log Details</Dialog.Title>
    </Dialog.Header>
    {#if selectedLog}
      {@const config = levelConfig[selectedLog.level]}
      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <Label class="text-muted-foreground text-xs">Timestamp</Label>
            <p class="font-medium">{formatTimestamp(selectedLog.timestamp)}</p>
          </div>
          <div>
            <Label class="text-muted-foreground text-xs">Level</Label>
            <Badge variant="outline" class={cn('text-xs', config.color, config.bgColor)}>
              <config.icon class="w-3 h-3 mr-1" />
              {selectedLog.level}
            </Badge>
          </div>
          <div>
            <Label class="text-muted-foreground text-xs">Source</Label>
            <p class="font-mono">{selectedLog.source}</p>
          </div>
          <div>
            <Label class="text-muted-foreground text-xs">ID</Label>
            <p class="font-mono">{selectedLog.id}</p>
          </div>
        </div>

        <div>
          <Label class="text-muted-foreground text-xs">Message</Label>
          <p class="mt-1 p-3 bg-muted rounded-md font-mono text-sm whitespace-pre-wrap break-all">
            {selectedLog.message}
          </p>
        </div>

        {#if selectedLog.details}
          <div>
            <Label class="text-muted-foreground text-xs">Details</Label>
            <pre
              class="mt-1 p-3 bg-muted rounded-md font-mono text-xs overflow-x-auto">{JSON.stringify(
                selectedLog.details,
                null,
                2
              )}</pre>
          </div>
        {/if}
      </div>
    {/if}
  </Dialog.Content>
</Dialog.Root>
