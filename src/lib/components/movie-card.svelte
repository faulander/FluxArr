<script lang="ts">
  import { Star, Calendar, Film, Clock, Check, Plus, Loader2 } from '@lucide/svelte';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import * as Popover from '$lib/components/ui/popover';
  import * as Select from '$lib/components/ui/select';
  import { cn } from '$lib/utils';
  import { toast } from 'svelte-sonner';
  import type { Movie } from '$lib/types';
  import { tmdbPosterUrl } from '$lib/types/movie';

  interface RadarrInstance {
    configId: number;
    configName: string;
  }

  interface RadarrConfig {
    id: number;
    name: string;
    is_default: number;
    qualityProfiles: { id: number; name: string }[];
    rootFolders: { id: number; path: string }[];
  }

  interface Props {
    movie: Movie;
    radarrInstances?: RadarrInstance[];
    radarrConfigs?: RadarrConfig[];
    class?: string;
  }

  let { movie, radarrInstances = [], radarrConfigs = [], class: className }: Props = $props();

  // Hover state
  let isHovered = $state(false);

  // Quick-add state
  let addPopoverOpen = $state(false);
  let isAdding = $state(false);
  let selectedConfigId = $state<string>('');
  let selectedQualityProfile = $state<string>('');
  let selectedRootFolder = $state<string>('');

  // Get default config once
  const defaultConfig = $derived(radarrConfigs.find((c) => c.is_default) || radarrConfigs[0]);

  const genres = $derived.by(() => {
    try {
      return JSON.parse(movie.genres || '[]').slice(0, 3);
    } catch {
      return [];
    }
  });

  const statusColor = $derived.by(() => {
    switch (movie.status) {
      case 'Released':
        return 'bg-black/70 text-green-400 border-green-500/50';
      case 'Post Production':
        return 'bg-black/70 text-yellow-400 border-yellow-500/50';
      case 'In Production':
        return 'bg-black/70 text-blue-400 border-blue-500/50';
      case 'Planned':
        return 'bg-black/70 text-purple-400 border-purple-500/50';
      default:
        return 'bg-black/70 text-gray-300 border-gray-500/50';
    }
  });

  const year = $derived(movie.release_date ? new Date(movie.release_date).getFullYear() : null);
  const inRadarr = $derived(radarrInstances.length > 0);
  const posterUrl = $derived(tmdbPosterUrl(movie.poster_path, 'w342'));

  const inAllRadarrInstances = $derived(
    radarrConfigs.length > 0 && radarrInstances.length >= radarrConfigs.length
  );
  const canQuickAdd = $derived(radarrConfigs.length > 0 && !inAllRadarrInstances);

  const selectedConfig = $derived(radarrConfigs.find((c) => c.id.toString() === selectedConfigId));

  function initializeDefaults() {
    if (defaultConfig) {
      selectedConfigId = defaultConfig.id.toString();
      if (defaultConfig.qualityProfiles.length > 0) {
        selectedQualityProfile = defaultConfig.qualityProfiles[0].id.toString();
      }
      if (defaultConfig.rootFolders.length > 0) {
        selectedRootFolder = defaultConfig.rootFolders[0].id.toString();
      }
    }
  }

  function handleConfigChange(newConfigId: string) {
    selectedConfigId = newConfigId;
    const config = radarrConfigs.find((c) => c.id.toString() === newConfigId);
    if (config) {
      if (config.qualityProfiles.length > 0) {
        selectedQualityProfile = config.qualityProfiles[0].id.toString();
      }
      if (config.rootFolders.length > 0) {
        selectedRootFolder = config.rootFolders[0].id.toString();
      }
    }
  }

  async function handleQuickAdd(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!selectedConfigId || !selectedQualityProfile || !selectedRootFolder) {
      toast.error('Please select all options');
      return;
    }

    isAdding = true;
    try {
      const response = await fetch('/api/radarr/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          configId: parseInt(selectedConfigId),
          tmdbId: movie.id,
          title: movie.title,
          movieId: movie.id,
          qualityProfileId: parseInt(selectedQualityProfile),
          rootFolderPath: selectedConfig?.rootFolders.find(
            (f) => f.id.toString() === selectedRootFolder
          )?.path
        })
      });

      if (response.ok) {
        toast.success(`Added "${movie.title}" to Radarr`);
        addPopoverOpen = false;
        window.location.reload();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to add to Radarr');
      }
    } catch {
      toast.error('Failed to add to Radarr');
    } finally {
      isAdding = false;
    }
  }
</script>

<div
  class={cn('block relative', className)}
  onmouseenter={() => (isHovered = true)}
  onmouseleave={() => {
    if (!addPopoverOpen) isHovered = false;
  }}
  role="group"
>
  <a href="/movies/{movie.id}">
    <Card.Root class="overflow-hidden transition-all hover:ring-2 hover:ring-primary/50 h-full">
      <div class="relative aspect-[2/3] bg-muted overflow-hidden">
        {#if posterUrl}
          <img
            src={posterUrl}
            alt={movie.title}
            class="object-cover w-full h-full"
            loading="lazy"
          />
        {:else}
          <div class="flex items-center justify-center w-full h-full text-muted-foreground">
            <Film class="w-12 h-12" />
          </div>
        {/if}

        <!-- Rating badge -->
        {#if movie.imdb_rating || movie.vote_average}
          <div
            class="absolute top-2 right-2 flex items-center gap-1.5 bg-black/70 backdrop-blur-sm text-white text-xs font-medium px-2 py-1 rounded"
          >
            {#if movie.imdb_rating}
              <span class="flex items-center gap-0.5" title="IMDB Rating">
                <Star class="w-3 h-3 fill-yellow-400 text-yellow-400" />
                {movie.imdb_rating.toFixed(1)}
              </span>
            {/if}
            {#if movie.imdb_rating && movie.vote_average}
              <span class="text-white/40">|</span>
            {/if}
            {#if movie.vote_average}
              <span class="flex items-center gap-0.5 text-white/70" title="TMDB Rating">
                {movie.vote_average.toFixed(1)}
              </span>
            {/if}
          </div>
        {/if}

        <!-- Status badge -->
        {#if movie.status}
          <div class="absolute top-2 left-2">
            <Badge variant="outline" class={cn('text-xs border backdrop-blur-sm', statusColor)}>
              {movie.status}
            </Badge>
          </div>
        {/if}

        <!-- In Radarr indicator(s) -->
        {#if inRadarr}
          <div
            class={cn(
              'absolute bottom-2 right-2 flex flex-col gap-1 items-end z-10 transition-opacity duration-200',
              isHovered ? 'opacity-0' : 'opacity-100'
            )}
          >
            {#each radarrInstances as instance (instance.configId)}
              <div
                class="flex items-center gap-1 bg-green-600 text-white text-xs font-medium px-2 py-0.5 rounded"
                title="In {instance.configName}"
              >
                <Check class="w-3 h-3" />
                <span class="max-w-20 truncate">{instance.configName}</span>
              </div>
            {/each}
          </div>
        {/if}

        <!-- Summary overlay on hover -->
        {#if movie.overview}
          <div
            class={cn(
              'absolute inset-0 bg-black/90 transition-opacity duration-200 flex items-end p-3 z-20 pointer-events-none',
              isHovered ? 'opacity-100' : 'opacity-0'
            )}
          >
            <p class="text-white text-xs leading-relaxed line-clamp-6">
              {movie.overview}
            </p>
          </div>
        {/if}
      </div>

      <Card.Content class="p-3 space-y-2">
        <h3
          class={cn(
            'font-semibold text-sm leading-tight line-clamp-2 transition-colors',
            isHovered && 'text-primary'
          )}
        >
          {movie.title}
        </h3>

        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {#if year}
            <span class="flex items-center gap-1">
              <Calendar class="w-3 h-3" />
              {year}
            </span>
          {/if}
          {#if movie.runtime}
            <span class="flex items-center gap-1">
              <Clock class="w-3 h-3" />
              {movie.runtime}m
            </span>
          {/if}
        </div>

        {#if genres.length > 0}
          <div class="flex flex-wrap gap-1">
            {#each genres as genre, i (i)}
              <Badge variant="secondary" class="text-xs px-1.5 py-0">
                {genre}
              </Badge>
            {/each}
          </div>
        {/if}
      </Card.Content>
    </Card.Root>
  </a>

  <!-- Quick Add to Radarr button -->
  {#if canQuickAdd}
    <div
      class={cn(
        'absolute top-1/4 left-1/2 -translate-x-1/2 z-30 transition-opacity duration-200',
        isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
      )}
    >
      <Popover.Root
        bind:open={addPopoverOpen}
        onOpenChange={(open) => {
          if (open) initializeDefaults();
        }}
      >
        <Popover.Trigger
          class="inline-flex items-center justify-center h-9 px-4 text-sm font-medium gap-1.5 shadow-lg rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors whitespace-nowrap"
          onclick={(e: MouseEvent) => e.stopPropagation()}
        >
          <Plus class="w-4 h-4 shrink-0" />
          Add to Radarr
        </Popover.Trigger>
        <Popover.Content class="w-64 p-3" align="start">
          <div class="space-y-3">
            <p class="text-sm font-medium">Add to Radarr</p>

            {#if radarrConfigs.length > 1}
              <div class="space-y-1">
                <span class="text-xs text-muted-foreground">Instance</span>
                <Select.Root
                  type="single"
                  value={selectedConfigId}
                  onValueChange={handleConfigChange}
                >
                  <Select.Trigger class="h-8 text-xs">
                    {selectedConfig?.name || 'Select...'}
                  </Select.Trigger>
                  <Select.Content>
                    {#each radarrConfigs as config (config.id)}
                      <Select.Item value={config.id.toString()} label={config.name} />
                    {/each}
                  </Select.Content>
                </Select.Root>
              </div>
            {/if}

            {#if selectedConfig}
              <div class="space-y-1">
                <span class="text-xs text-muted-foreground">Quality Profile</span>
                <Select.Root
                  type="single"
                  value={selectedQualityProfile}
                  onValueChange={(v) => (selectedQualityProfile = v)}
                >
                  <Select.Trigger class="h-8 text-xs">
                    {selectedConfig.qualityProfiles.find(
                      (p) => p.id.toString() === selectedQualityProfile
                    )?.name || 'Select...'}
                  </Select.Trigger>
                  <Select.Content>
                    {#each selectedConfig.qualityProfiles as profile (profile.id)}
                      <Select.Item value={profile.id.toString()} label={profile.name} />
                    {/each}
                  </Select.Content>
                </Select.Root>
              </div>

              <div class="space-y-1">
                <span class="text-xs text-muted-foreground">Root Folder</span>
                <Select.Root
                  type="single"
                  value={selectedRootFolder}
                  onValueChange={(v) => (selectedRootFolder = v)}
                >
                  <Select.Trigger class="h-8 text-xs">
                    {selectedConfig.rootFolders.find((f) => f.id.toString() === selectedRootFolder)
                      ?.path || 'Select...'}
                  </Select.Trigger>
                  <Select.Content>
                    {#each selectedConfig.rootFolders as folder (folder.id)}
                      <Select.Item value={folder.id.toString()} label={folder.path} />
                    {/each}
                  </Select.Content>
                </Select.Root>
              </div>

              <Button
                size="sm"
                class="w-full h-8 text-xs"
                disabled={isAdding || !selectedQualityProfile || !selectedRootFolder}
                onclick={handleQuickAdd}
              >
                {#if isAdding}
                  <Loader2 class="w-3 h-3 mr-1 animate-spin" />
                  Adding...
                {:else}
                  <Plus class="w-3 h-3 mr-1" />
                  Add to Radarr
                {/if}
              </Button>
            {/if}
          </div>
        </Popover.Content>
      </Popover.Root>
    </div>
  {/if}
</div>
