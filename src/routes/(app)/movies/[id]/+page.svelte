<script lang="ts">
  import { goto } from '$app/navigation';
  import { toast } from 'svelte-sonner';
  import {
    ArrowLeft,
    Star,
    Calendar,
    Clock,
    Film,
    ExternalLink,
    Send,
    Info,
    Loader2,
    Check,
    DollarSign
  } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as Select from '$lib/components/ui/select';
  import { Label } from '$lib/components/ui/label';
  import { Separator } from '$lib/components/ui/separator';
  import { tmdbPosterUrl, tmdbBackdropUrl } from '$lib/types/movie';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const movie = data.movie;

  const genres = $derived(() => {
    try {
      return JSON.parse(movie.genres || '[]') as string[];
    } catch {
      return [] as string[];
    }
  });

  const countries = $derived(() => {
    try {
      return JSON.parse(movie.production_countries || '[]') as string[];
    } catch {
      return [] as string[];
    }
  });

  const companies = $derived(() => {
    try {
      return JSON.parse(movie.production_companies || '[]') as { id: number; name: string; origin_country: string }[];
    } catch {
      return [] as { id: number; name: string; origin_country: string }[];
    }
  });

  const statusColor = $derived(() => {
    switch (movie.status) {
      case 'Released':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'Post Production':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'In Production':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'Planned':
        return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  });

  const year = $derived(movie.release_date ? new Date(movie.release_date).getFullYear() : null);
  const posterUrl = $derived(tmdbPosterUrl(movie.poster_path, 'w500'));

  function formatCurrency(amount: number | null): string {
    if (!amount || amount === 0) return '-';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
  }

  // Radarr configs
  const configsWithMovie = $derived(data.radarrConfigs.filter((c) => c.hasMovie));
  const configsWithoutMovie = $derived(data.radarrConfigs.filter((c) => !c.hasMovie));

  // Radarr dialog state
  let radarrDialogOpen = $state(false);
  let selectedConfigId = $state<string>(
    configsWithoutMovie.find((c) => c.is_default)?.id.toString() ||
      configsWithoutMovie[0]?.id.toString() ||
      ''
  );
  let selectedQualityProfileId = $state<string>('');
  let selectedRootFolderId = $state<string>('');
  let isSending = $state(false);

  const selectedConfig = $derived(() => {
    if (!selectedConfigId) return null;
    return configsWithoutMovie.find((c) => c.id.toString() === selectedConfigId) || null;
  });

  const selectedConfigName = $derived(() => {
    const config = selectedConfig();
    return config?.name || 'Select instance...';
  });

  const selectedQualityProfileName = $derived(() => {
    const config = selectedConfig();
    if (!config || !selectedQualityProfileId) return 'Select profile...';
    const profile = config.qualityProfiles.find(
      (p) => p.id.toString() === selectedQualityProfileId
    );
    return profile?.name || 'Select profile...';
  });

  const selectedRootFolderName = $derived(() => {
    const config = selectedConfig();
    if (!config || !selectedRootFolderId) return 'Select folder...';
    const folder = config.rootFolders.find((f) => f.id.toString() === selectedRootFolderId);
    return folder?.path || 'Select folder...';
  });

  $effect(() => {
    const config = selectedConfig();
    if (config) {
      if (config.qualityProfiles.length > 0 && !selectedQualityProfileId) {
        selectedQualityProfileId = config.qualityProfiles[0].id.toString();
      }
      if (config.rootFolders.length > 0 && !selectedRootFolderId) {
        selectedRootFolderId = config.rootFolders[0].id.toString();
      }
    }
  });

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  async function sendToRadarr() {
    if (!selectedConfigId || !selectedQualityProfileId || !selectedRootFolderId) {
      toast.error('Please select all options');
      return;
    }

    const config = selectedConfig();
    if (!config) return;

    const rootFolder = config.rootFolders.find((f) => f.id.toString() === selectedRootFolderId);
    if (!rootFolder) return;

    isSending = true;

    try {
      const response = await fetch('/api/radarr/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          configId: parseInt(selectedConfigId, 10),
          tmdbId: movie.id,
          title: movie.title,
          movieId: movie.id,
          qualityProfileId: parseInt(selectedQualityProfileId, 10),
          rootFolderPath: rootFolder.path
        })
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'Failed to add movie to Radarr');
        return;
      }

      toast.success(`${movie.title} added to Radarr!`);
      radarrDialogOpen = false;
    } catch {
      toast.error('Failed to connect to Radarr');
    } finally {
      isSending = false;
    }
  }
</script>

<div class="min-h-screen">
  <!-- Hero section -->
  <div class="relative">
    <div
      class="absolute inset-0 bg-gradient-to-b from-background/80 via-background/95 to-background"
    ></div>

    <div class="relative container mx-auto px-4 py-6">
      <!-- Back button -->
      <Button variant="ghost" size="sm" onclick={() => goto('/movies')} class="mb-6 -ml-2">
        <ArrowLeft class="w-4 h-4 mr-2" />
        Back to Movies
      </Button>

      <div class="flex flex-col md:flex-row gap-8">
        <!-- Poster -->
        <div class="shrink-0 mx-auto md:mx-0">
          <div class="relative w-64 aspect-[2/3] rounded-lg overflow-hidden shadow-xl bg-muted">
            {#if posterUrl}
              <img
                src={posterUrl}
                alt={movie.title}
                class="w-full h-full object-cover"
              />
            {:else}
              <div class="w-full h-full flex items-center justify-center">
                <Film class="w-16 h-16 text-muted-foreground" />
              </div>
            {/if}
          </div>
        </div>

        <!-- Info -->
        <div class="flex-1 space-y-4">
          <div>
            <h1 class="text-3xl md:text-4xl font-bold">{movie.title}</h1>
            {#if movie.tagline}
              <p class="text-muted-foreground italic mt-1">{movie.tagline}</p>
            {/if}

            <div class="flex flex-wrap items-center gap-3 mt-3">
              {#if movie.status}
                <Badge variant="outline" class={statusColor()}>{movie.status}</Badge>
              {/if}

              {#if movie.imdb_rating || movie.vote_average}
                <div class="flex items-center gap-2 text-sm">
                  {#if movie.imdb_rating}
                    <div class="flex items-center gap-1" title="IMDB Rating">
                      <Star class="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span class="font-medium">{movie.imdb_rating.toFixed(1)}</span>
                      <span class="text-xs text-muted-foreground">IMDB</span>
                    </div>
                  {/if}
                  {#if movie.imdb_rating && movie.vote_average}
                    <span class="text-muted-foreground">·</span>
                  {/if}
                  {#if movie.vote_average}
                    <div class="flex items-center gap-1" title="TMDB Rating">
                      <Star class="w-4 h-4 fill-gray-400 text-gray-400" />
                      <span class="font-medium text-muted-foreground"
                        >{movie.vote_average.toFixed(1)}</span
                      >
                      <span class="text-xs text-muted-foreground">TMDB</span>
                    </div>
                  {/if}
                </div>
              {/if}

              {#if year}
                <div class="flex items-center gap-1 text-sm text-muted-foreground">
                  <Calendar class="w-4 h-4" />
                  {movie.release_date}
                </div>
              {/if}

              {#if movie.runtime}
                <div class="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock class="w-4 h-4" />
                  {Math.floor(movie.runtime / 60)}h {movie.runtime % 60}m
                </div>
              {/if}
            </div>
          </div>

          <!-- Genres -->
          {#if genres().length > 0}
            <div class="flex flex-wrap gap-2">
              {#each genres() as genre}
                <Badge variant="secondary">{genre}</Badge>
              {/each}
            </div>
          {/if}

          <!-- Description -->
          <p class="text-muted-foreground leading-relaxed max-w-3xl">
            {movie.overview || 'No description available.'}
          </p>

          <!-- Radarr Status Banner -->
          {#if configsWithMovie.length > 0}
            <div
              class="flex items-start gap-4 p-4 rounded-lg bg-green-500/10 border border-green-500/20"
            >
              <div class="flex items-center justify-center w-10 h-10 rounded-full bg-green-500/20">
                <Check class="w-5 h-5 text-green-500" />
              </div>
              <div class="flex-1">
                <h4 class="font-medium text-green-600 dark:text-green-400">
                  In Radarr ({configsWithMovie.length} instance{configsWithMovie.length > 1
                    ? 's'
                    : ''})
                </h4>
                <div class="flex flex-wrap gap-2 mt-2">
                  {#each configsWithMovie as config (config.id)}
                    <Badge variant="secondary" class="text-xs">
                      <Check class="w-3 h-3 mr-1" />
                      {config.name}
                    </Badge>
                  {/each}
                </div>
              </div>
            </div>
          {/if}

          <!-- Actions -->
          <div class="flex flex-wrap gap-3 pt-2">
            {#if configsWithoutMovie.length > 0}
              <Dialog.Root bind:open={radarrDialogOpen}>
                <Dialog.Trigger>
                  {#snippet child({ props })}
                    <Button {...props} class="gap-2">
                      <Send class="w-4 h-4" />
                      {configsWithMovie.length > 0 ? 'Add to Another Radarr' : 'Send to Radarr'}
                    </Button>
                  {/snippet}
                </Dialog.Trigger>
                <Dialog.Content>
                  <Dialog.Header>
                    <Dialog.Title>Add to Radarr</Dialog.Title>
                    <Dialog.Description>
                      Add "{movie.title}" to your Radarr instance for automatic downloading.
                    </Dialog.Description>
                  </Dialog.Header>

                  <div class="space-y-4 py-4">
                    <div class="space-y-2">
                      <Label>Radarr Instance</Label>
                      <Select.Root type="single" bind:value={selectedConfigId}>
                        <Select.Trigger class="w-full">
                          {selectedConfigName()}
                        </Select.Trigger>
                        <Select.Content>
                          {#each configsWithoutMovie as config (config.id)}
                            <Select.Item value={config.id.toString()}>
                              {config.name}
                              {#if config.is_default}
                                <Badge variant="secondary" class="ml-2 text-xs">Default</Badge>
                              {/if}
                            </Select.Item>
                          {/each}
                        </Select.Content>
                      </Select.Root>
                    </div>

                    {#if selectedConfig()}
                      <div class="space-y-2">
                        <Label>Quality Profile</Label>
                        <Select.Root type="single" bind:value={selectedQualityProfileId}>
                          <Select.Trigger class="w-full">
                            {selectedQualityProfileName()}
                          </Select.Trigger>
                          <Select.Content>
                            {#each selectedConfig()?.qualityProfiles || [] as profile (profile.id)}
                              <Select.Item value={profile.id.toString()}>
                                {profile.name}
                              </Select.Item>
                            {/each}
                          </Select.Content>
                        </Select.Root>
                      </div>

                      <div class="space-y-2">
                        <Label>Root Folder</Label>
                        <Select.Root type="single" bind:value={selectedRootFolderId}>
                          <Select.Trigger class="w-full">
                            {selectedRootFolderName()}
                          </Select.Trigger>
                          <Select.Content>
                            {#each selectedConfig()?.rootFolders || [] as folder (folder.id)}
                              <Select.Item value={folder.id.toString()}>
                                {folder.path}
                                <span class="ml-2 text-xs text-muted-foreground">
                                  ({formatBytes(folder.freeSpace)} free)
                                </span>
                              </Select.Item>
                            {/each}
                          </Select.Content>
                        </Select.Root>
                      </div>
                    {/if}
                  </div>

                  <Dialog.Footer>
                    <Button variant="outline" onclick={() => (radarrDialogOpen = false)}>
                      Cancel
                    </Button>
                    <Button
                      onclick={sendToRadarr}
                      disabled={isSending ||
                        !selectedConfigId ||
                        !selectedQualityProfileId ||
                        !selectedRootFolderId}
                    >
                      {#if isSending}
                        <Loader2 class="w-4 h-4 mr-2 animate-spin" />
                        Adding...
                      {:else}
                        Add to Radarr
                      {/if}
                    </Button>
                  </Dialog.Footer>
                </Dialog.Content>
              </Dialog.Root>
            {:else if configsWithMovie.length > 0 && configsWithoutMovie.length === 0}
              <Button disabled variant="outline" class="gap-2">
                <Check class="w-4 h-4" />
                In All Radarr Instances
              </Button>
            {:else if data.radarrConfigs.length === 0}
              <Button disabled variant="outline" class="gap-2">
                <Send class="w-4 h-4" />
                Configure Radarr in Settings
              </Button>
            {/if}

            {#if movie.imdb_id}
              <Button
                variant="outline"
                href={`https://www.imdb.com/title/${movie.imdb_id}`}
                target="_blank"
                class="gap-2"
              >
                <ExternalLink class="w-4 h-4" />
                IMDb
              </Button>
            {/if}

            <Button
              variant="outline"
              href={`https://www.themoviedb.org/movie/${movie.id}`}
              target="_blank"
              class="gap-2"
            >
              <ExternalLink class="w-4 h-4" />
              TMDB
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <Separator class="my-6" />

  <!-- Details -->
  <div class="container mx-auto px-4 pb-12">
    <h2 class="text-xl font-semibold mb-4 flex items-center gap-2">
      <Info class="w-5 h-5" />
      Details
    </h2>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
      <div>
        <h3 class="text-sm font-medium text-muted-foreground mb-1">Status</h3>
        <p>{movie.status || 'Unknown'}</p>
      </div>

      <div>
        <h3 class="text-sm font-medium text-muted-foreground mb-1">Release Date</h3>
        <p>{movie.release_date || 'Unknown'}</p>
      </div>

      {#if movie.runtime}
        <div>
          <h3 class="text-sm font-medium text-muted-foreground mb-1">Runtime</h3>
          <p>{movie.runtime} minutes</p>
        </div>
      {/if}

      {#if movie.language}
        <div>
          <h3 class="text-sm font-medium text-muted-foreground mb-1">Original Language</h3>
          <p>{movie.language}</p>
        </div>
      {/if}

      {#if movie.budget && movie.budget > 0}
        <div>
          <h3 class="text-sm font-medium text-muted-foreground mb-1">Budget</h3>
          <p>{formatCurrency(movie.budget)}</p>
        </div>
      {/if}

      {#if movie.revenue && movie.revenue > 0}
        <div>
          <h3 class="text-sm font-medium text-muted-foreground mb-1">Revenue</h3>
          <p>{formatCurrency(movie.revenue)}</p>
        </div>
      {/if}

      {#if movie.vote_count}
        <div>
          <h3 class="text-sm font-medium text-muted-foreground mb-1">TMDB Votes</h3>
          <p>{movie.vote_count.toLocaleString()}</p>
        </div>
      {/if}

      <div>
        <h3 class="text-sm font-medium text-muted-foreground mb-1">TMDB ID</h3>
        <p>{movie.id}</p>
      </div>

      {#if movie.imdb_id}
        <div>
          <h3 class="text-sm font-medium text-muted-foreground mb-1">IMDb ID</h3>
          <p>{movie.imdb_id}</p>
        </div>
      {/if}
    </div>

    {#if countries().length > 0}
      <div class="mt-6">
        <h3 class="text-sm font-medium text-muted-foreground mb-2">Production Countries</h3>
        <div class="flex flex-wrap gap-2">
          {#each countries() as country}
            <Badge variant="outline">{country}</Badge>
          {/each}
        </div>
      </div>
    {/if}

    {#if companies().length > 0}
      <div class="mt-6">
        <h3 class="text-sm font-medium text-muted-foreground mb-2">Production Companies</h3>
        <div class="flex flex-wrap gap-2">
          {#each companies() as company}
            <Badge variant="secondary">{company.name}</Badge>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <!-- TMDB Attribution -->
  <div class="container mx-auto px-4 pb-8">
    <p class="text-xs text-muted-foreground">
      Movie data provided by
      <a href="https://www.themoviedb.org" target="_blank" class="underline hover:text-foreground">
        TMDB
      </a>
    </p>
  </div>
</div>
