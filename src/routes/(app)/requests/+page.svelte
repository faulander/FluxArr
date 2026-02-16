<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { toast } from 'svelte-sonner';
  import {
    Tv,
    Film,
    Loader2,
    RefreshCw,
    Trash2,
    CheckCircle,
    Clock,
    AlertCircle,
    HardDrive,
    Download,
    Users
  } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import * as Card from '$lib/components/ui/card';
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import { Switch } from '$lib/components/ui/switch';
  import { Label } from '$lib/components/ui/label';
  import type { PageData } from './$types';

  interface SonarrStatus {
    seriesId: number;
    monitored: boolean;
    status: string;
    episodeFileCount: number;
    episodeCount: number;
    totalEpisodeCount: number;
    sizeOnDisk: number;
    percentOfEpisodes: number;
  }

  interface RadarrStatus {
    movieId: number;
    monitored: boolean;
    status: string;
    hasFile: boolean;
    sizeOnDisk: number;
  }

  interface ShowRequest {
    id: number;
    type: 'show';
    showId: number;
    showName: string;
    showImage: string | null;
    showStatus: string | null;
    configId: number;
    configName: string;
    userId: number;
    userName: string;
    status: string;
    requestedAt: string;
    sonarr: SonarrStatus | null;
  }

  interface MovieRequest {
    id: number;
    type: 'movie';
    movieId: number;
    movieTitle: string;
    moviePoster: string | null;
    movieStatus: string | null;
    configId: number;
    configName: string;
    userId: number;
    userName: string;
    status: string;
    requestedAt: string;
    radarr: RadarrStatus | null;
  }

  let { data }: { data: PageData } = $props();

  let activeTab = $state<'show' | 'movie'>('show');
  let showRequests = $state<ShowRequest[]>([]);
  let movieRequests = $state<MovieRequest[]>([]);
  let isLoading = $state(true);
  let isRefreshing = $state(false);
  let showAllUsers = $state(false);
  let deleteDialogOpen = $state(false);
  let deletingRequest = $state<ShowRequest | MovieRequest | null>(null);

  onMount(() => {
    loadRequests();
  });

  async function loadRequests() {
    try {
      const params = new URLSearchParams();
      params.set('type', activeTab);
      if (showAllUsers && data.isAdmin) {
        params.set('all', 'true');
      }
      const response = await fetch(`/api/requests?${params}`);
      const result = await response.json();
      if (result.requests) {
        if (activeTab === 'movie') {
          movieRequests = result.requests;
        } else {
          showRequests = result.requests;
        }
      }
    } catch (error) {
      console.error('Failed to load requests:', error);
      toast.error('Failed to load requests');
    } finally {
      isLoading = false;
      isRefreshing = false;
    }
  }

  async function refresh() {
    isRefreshing = true;
    await loadRequests();
  }

  function openDeleteDialog(request: ShowRequest | MovieRequest) {
    deletingRequest = request;
    deleteDialogOpen = true;
  }

  async function deleteRequest() {
    if (!deletingRequest) return;

    try {
      const type = 'movieId' in deletingRequest ? 'movie' : 'show';
      const response = await fetch(`/api/requests?id=${deletingRequest.id}&type=${type}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const result = await response.json();
        toast.error(result.error || 'Failed to delete request');
        return;
      }

      if (type === 'movie') {
        movieRequests = movieRequests.filter((r) => r.id !== deletingRequest!.id);
      } else {
        showRequests = showRequests.filter((r) => r.id !== deletingRequest!.id);
      }
      toast.success('Request removed');
      deleteDialogOpen = false;
      deletingRequest = null;
    } catch {
      toast.error('Failed to delete request');
    }
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  function getShowStatusBadge(request: ShowRequest): {
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    text: string;
  } {
    if (request.status === 'failed') {
      return { variant: 'destructive', text: 'Failed' };
    }
    if (!request.sonarr) {
      return { variant: 'outline', text: 'Not in Sonarr' };
    }
    if (request.sonarr.percentOfEpisodes >= 100) {
      return { variant: 'default', text: 'Complete' };
    }
    if (request.sonarr.episodeFileCount > 0) {
      return { variant: 'secondary', text: 'Downloading' };
    }
    return { variant: 'outline', text: 'Pending' };
  }

  function getMovieStatusBadge(request: MovieRequest): {
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    text: string;
  } {
    if (request.status === 'failed') {
      return { variant: 'destructive', text: 'Failed' };
    }
    if (!request.radarr) {
      return { variant: 'outline', text: 'Not in Radarr' };
    }
    if (request.radarr.hasFile) {
      return { variant: 'default', text: 'Downloaded' };
    }
    if (request.radarr.monitored) {
      return { variant: 'secondary', text: 'Monitored' };
    }
    return { variant: 'outline', text: 'Pending' };
  }

  $effect(() => {
    // Reload when tab changes
    activeTab;
    if (!isLoading) {
      loadRequests();
    }
  });
</script>

<div class="container mx-auto px-4 py-6 max-w-6xl space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold">My Requests</h1>
      <p class="text-muted-foreground text-sm">Content you've added through FluxArr</p>
    </div>
    <div class="flex items-center gap-4">
      {#if data.isAdmin}
        <div class="flex items-center gap-2">
          <Switch id="show-all" bind:checked={showAllUsers} />
          <Label for="show-all" class="text-sm">Show all users</Label>
        </div>
      {/if}
      <Button variant="outline" size="sm" onclick={refresh} disabled={isRefreshing}>
        <RefreshCw class="w-4 h-4 mr-2 {isRefreshing ? 'animate-spin' : ''}" />
        Refresh
      </Button>
    </div>
  </div>

  <!-- Tab Toggle -->
  <div class="flex gap-1 p-1 bg-muted rounded-lg w-fit">
    <button
      class="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors {activeTab ===
      'show'
        ? 'bg-background shadow-sm'
        : 'text-muted-foreground hover:text-foreground'}"
      onclick={() => (activeTab = 'show')}
    >
      <Tv class="w-4 h-4" />
      Shows
    </button>
    <button
      class="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors {activeTab ===
      'movie'
        ? 'bg-background shadow-sm'
        : 'text-muted-foreground hover:text-foreground'}"
      onclick={() => (activeTab = 'movie')}
    >
      <Film class="w-4 h-4" />
      Movies
    </button>
  </div>

  {#if isLoading}
    <div class="flex items-center justify-center py-12">
      <Loader2 class="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  {:else if activeTab === 'show'}
    <!-- Show Requests -->
    {#if showRequests.length === 0}
      <Card.Root>
        <Card.Content class="py-12 text-center">
          <Tv class="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 class="text-lg font-medium">No show requests yet</h3>
          <p class="text-muted-foreground text-sm mt-1">
            Shows you add to Sonarr through FluxArr will appear here.
          </p>
          <Button class="mt-4" onclick={() => goto('/shows')}>Browse Shows</Button>
        </Card.Content>
      </Card.Root>
    {:else}
      <div class="space-y-4">
        {#each showRequests as request (request.id)}
          {@const statusBadge = getShowStatusBadge(request)}
          <Card.Root>
            <Card.Content class="p-4">
              <div class="flex gap-4">
                <a href="/shows/{request.showId}" class="shrink-0">
                  <div class="w-16 h-24 rounded overflow-hidden bg-muted">
                    {#if request.showImage}
                      <img
                        src={request.showImage}
                        alt={request.showName}
                        class="w-full h-full object-cover"
                      />
                    {:else}
                      <div class="w-full h-full flex items-center justify-center">
                        <Tv class="w-6 h-6 text-muted-foreground" />
                      </div>
                    {/if}
                  </div>
                </a>

                <div class="flex-1 min-w-0">
                  <div class="flex items-start justify-between gap-2">
                    <div>
                      <a href="/shows/{request.showId}" class="font-semibold hover:underline">
                        {request.showName}
                      </a>
                      <div class="flex flex-wrap items-center gap-2 mt-1">
                        <Badge variant={statusBadge.variant}>
                          {#if statusBadge.text === 'Complete'}
                            <CheckCircle class="w-3 h-3 mr-1" />
                          {:else if statusBadge.text === 'Downloading'}
                            <Download class="w-3 h-3 mr-1" />
                          {:else if statusBadge.text === 'Failed'}
                            <AlertCircle class="w-3 h-3 mr-1" />
                          {:else}
                            <Clock class="w-3 h-3 mr-1" />
                          {/if}
                          {statusBadge.text}
                        </Badge>
                        <Badge variant="outline" class="text-xs">{request.configName}</Badge>
                        {#if showAllUsers && data.isAdmin}
                          <Badge variant="secondary" class="text-xs">
                            <Users class="w-3 h-3 mr-1" />
                            {request.userName}
                          </Badge>
                        {/if}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="text-destructive hover:text-destructive shrink-0"
                      onclick={() => openDeleteDialog(request)}
                    >
                      <Trash2 class="w-4 h-4" />
                    </Button>
                  </div>

                  {#if request.sonarr}
                    <div
                      class="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground"
                    >
                      <div class="flex items-center gap-1">
                        <Tv class="w-4 h-4" />
                        <span>
                          {request.sonarr.episodeFileCount} / {request.sonarr.episodeCount} episodes
                        </span>
                      </div>
                      <div class="flex items-center gap-1">
                        <HardDrive class="w-4 h-4" />
                        <span>{formatBytes(request.sonarr.sizeOnDisk)}</span>
                      </div>
                      <div class="flex items-center gap-1">
                        <Download class="w-4 h-4" />
                        <span>{Math.round(request.sonarr.percentOfEpisodes)}%</span>
                      </div>
                    </div>

                    <div class="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        class="h-full bg-primary transition-all"
                        style="width: {request.sonarr.percentOfEpisodes}%"
                      ></div>
                    </div>
                  {/if}

                  <p class="text-xs text-muted-foreground mt-2">
                    Requested {formatDate(request.requestedAt)}
                  </p>
                </div>
              </div>
            </Card.Content>
          </Card.Root>
        {/each}
      </div>
    {/if}
  {:else}
    <!-- Movie Requests -->
    {#if movieRequests.length === 0}
      <Card.Root>
        <Card.Content class="py-12 text-center">
          <Film class="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 class="text-lg font-medium">No movie requests yet</h3>
          <p class="text-muted-foreground text-sm mt-1">
            Movies you add to Radarr through FluxArr will appear here.
          </p>
          <Button class="mt-4" onclick={() => goto('/movies')}>Browse Movies</Button>
        </Card.Content>
      </Card.Root>
    {:else}
      <div class="space-y-4">
        {#each movieRequests as request (request.id)}
          {@const statusBadge = getMovieStatusBadge(request)}
          <Card.Root>
            <Card.Content class="p-4">
              <div class="flex gap-4">
                <a href="/movies/{request.movieId}" class="shrink-0">
                  <div class="w-16 h-24 rounded overflow-hidden bg-muted">
                    {#if request.moviePoster}
                      <img
                        src={request.moviePoster}
                        alt={request.movieTitle}
                        class="w-full h-full object-cover"
                      />
                    {:else}
                      <div class="w-full h-full flex items-center justify-center">
                        <Film class="w-6 h-6 text-muted-foreground" />
                      </div>
                    {/if}
                  </div>
                </a>

                <div class="flex-1 min-w-0">
                  <div class="flex items-start justify-between gap-2">
                    <div>
                      <a href="/movies/{request.movieId}" class="font-semibold hover:underline">
                        {request.movieTitle}
                      </a>
                      <div class="flex flex-wrap items-center gap-2 mt-1">
                        <Badge variant={statusBadge.variant}>
                          {#if statusBadge.text === 'Downloaded'}
                            <CheckCircle class="w-3 h-3 mr-1" />
                          {:else if statusBadge.text === 'Monitored'}
                            <Download class="w-3 h-3 mr-1" />
                          {:else if statusBadge.text === 'Failed'}
                            <AlertCircle class="w-3 h-3 mr-1" />
                          {:else}
                            <Clock class="w-3 h-3 mr-1" />
                          {/if}
                          {statusBadge.text}
                        </Badge>
                        <Badge variant="outline" class="text-xs">{request.configName}</Badge>
                        {#if showAllUsers && data.isAdmin}
                          <Badge variant="secondary" class="text-xs">
                            <Users class="w-3 h-3 mr-1" />
                            {request.userName}
                          </Badge>
                        {/if}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="text-destructive hover:text-destructive shrink-0"
                      onclick={() => openDeleteDialog(request)}
                    >
                      <Trash2 class="w-4 h-4" />
                    </Button>
                  </div>

                  {#if request.radarr}
                    <div
                      class="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground"
                    >
                      <div class="flex items-center gap-1">
                        <HardDrive class="w-4 h-4" />
                        <span>{formatBytes(request.radarr.sizeOnDisk)}</span>
                      </div>
                      {#if request.radarr.hasFile}
                        <div class="flex items-center gap-1 text-green-600 dark:text-green-400">
                          <CheckCircle class="w-4 h-4" />
                          <span>Downloaded</span>
                        </div>
                      {/if}
                    </div>
                  {/if}

                  <p class="text-xs text-muted-foreground mt-2">
                    Requested {formatDate(request.requestedAt)}
                  </p>
                </div>
              </div>
            </Card.Content>
          </Card.Root>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<!-- Delete Confirmation Dialog -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Remove Request</AlertDialog.Title>
      <AlertDialog.Description>
        {#if deletingRequest && 'movieTitle' in deletingRequest}
          Remove "{deletingRequest.movieTitle}" from your requests? This only removes it from
          FluxArr tracking, not from Radarr.
        {:else if deletingRequest && 'showName' in deletingRequest}
          Remove "{deletingRequest.showName}" from your requests? This only removes it from FluxArr
          tracking, not from Sonarr.
        {/if}
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action onclick={deleteRequest}>Remove</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
