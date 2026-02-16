<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import {
    Search,
    Filter,
    RefreshCw,
    AlertCircle,
    X,
    Loader2,
    ArrowUpDown,
    Check
  } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Badge } from '$lib/components/ui/badge';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import MovieCard from '$lib/components/movie-card.svelte';
  import type { PageData } from './$types';
  import type { MovieFilterConfig } from '$lib/types/filter';
  import type { Movie } from '$lib/types';

  type SortOption = 'vote_average' | 'imdb_rating' | 'title' | 'release_date' | 'popularity' | 'updated';
  type SortOrder = 'asc' | 'desc';

  const sortOptions: { value: SortOption; label: string; defaultOrder: SortOrder }[] = [
    { value: 'popularity', label: 'Popularity', defaultOrder: 'desc' },
    { value: 'vote_average', label: 'TMDB Rating', defaultOrder: 'desc' },
    { value: 'imdb_rating', label: 'IMDB Rating', defaultOrder: 'desc' },
    { value: 'title', label: 'Title', defaultOrder: 'asc' },
    { value: 'release_date', label: 'Release Date', defaultOrder: 'desc' },
    { value: 'updated', label: 'Recently Updated', defaultOrder: 'desc' }
  ];

  let { data }: { data: PageData } = $props();

  let loadMoreTrigger = $state<HTMLDivElement | null>(null);

  // Local state for search input
  let searchInput = $state(data.currentSearch || '');

  // Infinite scroll state
  let extraMovies = $state<Movie[]>([]);
  let currentPage = $state(1);
  let isLoading = $state(false);

  // Derived values
  const allMovies = $derived([...data.movies, ...extraMovies]);
  const hasMore = $derived(allMovies.length < data.total);
  const currentFilter = $derived<MovieFilterConfig>(data.currentFilter || { include: {}, exclude: {} });
  const radarrTmdbMap = $derived(data.radarrTmdbMap || {});
  const currentSort = $derived<SortOption>(data.currentSort || 'popularity');
  const currentSortOrder = $derived<SortOrder>(data.currentSortOrder || 'desc');
  const currentSortLabel = $derived(
    sortOptions.find((o) => o.value === currentSort)?.label || 'Popularity'
  );

  // Create a signature from the data to detect changes
  const dataSignature = $derived(
    `${data.currentSearch || ''}-${JSON.stringify(data.currentFilter || {})}-${data.total}-${data.currentSort}-${data.currentSortOrder}`
  );

  let lastDataSignature = '';

  // Reset state when server data changes
  $effect(() => {
    if (dataSignature !== lastDataSignature) {
      lastDataSignature = dataSignature;
      extraMovies = [];
      currentPage = 1;
      searchInput = data.currentSearch || '';
    }
  });

  // Intersection Observer for infinite scroll
  $effect(() => {
    const trigger = loadMoreTrigger;
    if (!trigger) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(trigger);

    return () => observer.disconnect();
  });

  async function loadMore() {
    if (isLoading || allMovies.length >= data.total) return;

    isLoading = true;
    const nextPage = currentPage + 1;

    try {
      const params = new URLSearchParams();
      params.set('page', nextPage.toString());
      params.set('limit', '24');

      if (data.currentSearch) {
        params.set('search', data.currentSearch);
      }
      if (data.currentFilter) {
        params.set('filter', JSON.stringify(data.currentFilter));
      }
      if (data.currentSort) {
        params.set('sort', data.currentSort);
      }
      if (data.currentSortOrder) {
        params.set('order', data.currentSortOrder);
      }

      const response = await fetch(`/api/movies?${params}`);
      const result = await response.json();

      if (result.movies?.length > 0) {
        extraMovies = [...extraMovies, ...result.movies];
        currentPage = nextPage;
      }
    } catch (error) {
      console.error('Failed to load more movies:', error);
    } finally {
      isLoading = false;
    }
  }

  // Count active filters
  const activeFilterCount = $derived(() => {
    let count = 0;
    const inc = currentFilter.include || {};
    const exc = currentFilter.exclude || {};

    if (inc.languages?.length) count++;
    if (inc.genres?.length) count++;
    if (inc.status?.length) count++;
    if (inc.countries?.length) count++;
    if (inc.ratingMin !== undefined || inc.ratingMax !== undefined) count++;
    if (inc.imdbRatingMin !== undefined || inc.imdbRatingMax !== undefined) count++;
    if (inc.releasedAfter || inc.releasedBefore) count++;
    if (inc.runtimeMin !== undefined || inc.runtimeMax !== undefined) count++;

    if (exc.languages?.length) count++;
    if (exc.genres?.length) count++;
    if (exc.status?.length) count++;
    if (exc.countries?.length) count++;

    return count;
  });

  function handleSearch(e: Event) {
    e.preventDefault();
    const url = new URL($page.url);
    if (searchInput.trim()) {
      url.searchParams.set('search', searchInput.trim());
    } else {
      url.searchParams.delete('search');
    }
    goto(url.toString(), { invalidateAll: true });
  }

  function clearSearch() {
    searchInput = '';
    const url = new URL($page.url);
    url.searchParams.delete('search');
    goto(url.toString(), { invalidateAll: true });
  }

  function clearFilters() {
    const url = new URL($page.url);
    url.searchParams.set('filter', '{}');
    goto(url.toString(), { invalidateAll: true });
  }

  function handleSort(sortBy: SortOption) {
    const url = new URL($page.url);
    const option = sortOptions.find((o) => o.value === sortBy);

    if (sortBy === currentSort) {
      const newOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
      url.searchParams.set('order', newOrder);
    } else {
      url.searchParams.set('sort', sortBy);
      url.searchParams.set('order', option?.defaultOrder || 'desc');
    }

    goto(url.toString(), { invalidateAll: true });
  }
</script>

<div class="container mx-auto px-4 py-6 space-y-6">
  <!-- Header -->
  <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h1 class="text-2xl font-bold">Movies</h1>
      <p class="text-muted-foreground text-sm">
        {data.total.toLocaleString()} movies available
        {#if data.syncStatus?.is_syncing}
          <span class="inline-flex items-center gap-1 text-yellow-500 ml-2">
            <RefreshCw class="w-3 h-3 animate-spin" />
            Syncing...
          </span>
        {/if}
      </p>
    </div>
  </div>

  <!-- Search and Sort Bar -->
  <div class="flex flex-col sm:flex-row gap-3">
    <form onsubmit={handleSearch} class="flex-1 flex gap-2">
      <div class="relative flex-1">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search movies..."
          bind:value={searchInput}
          class="pl-9 pr-9"
        />
        {#if searchInput}
          <button
            type="button"
            onclick={clearSearch}
            class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X class="w-4 h-4" />
          </button>
        {/if}
      </div>
      <Button type="submit" variant="secondary">Search</Button>
    </form>

    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button {...props} variant="outline" class="gap-2">
            <ArrowUpDown class="w-4 h-4" />
            <span class="hidden sm:inline">Sort:</span>
            {currentSortLabel}
            {#if currentSortOrder === 'asc'}
              <span class="text-xs">↑</span>
            {:else}
              <span class="text-xs">↓</span>
            {/if}
          </Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        {#each sortOptions as option (option.value)}
          <DropdownMenu.Item class="gap-2 cursor-pointer" onclick={() => handleSort(option.value)}>
            {#if currentSort === option.value}
              <Check class="w-4 h-4" />
            {:else}
              <span class="w-4"></span>
            {/if}
            {option.label}
            {#if currentSort === option.value}
              <span class="ml-auto text-xs text-muted-foreground">
                {currentSortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
              </span>
            {/if}
          </DropdownMenu.Item>
        {/each}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </div>

  <!-- Active filters display -->
  {#if activeFilterCount() > 0}
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-sm text-muted-foreground">Active filters:</span>
      {#if currentFilter.include?.languages?.length}
        <Badge variant="outline" class="gap-1">
          Language: {currentFilter.include.languages.join(', ')}
        </Badge>
      {/if}
      {#if currentFilter.include?.genres?.length}
        <Badge variant="outline" class="gap-1 bg-green-500/10">
          + Genres: {currentFilter.include.genres.join(', ')}
        </Badge>
      {/if}
      {#if currentFilter.exclude?.genres?.length}
        <Badge variant="outline" class="gap-1 bg-red-500/10">
          - Genres: {currentFilter.exclude.genres.join(', ')}
        </Badge>
      {/if}
      {#if currentFilter.include?.status?.length}
        <Badge variant="outline" class="gap-1">
          Status: {currentFilter.include.status.join(', ')}
        </Badge>
      {/if}
      {#if currentFilter.include?.ratingMin !== undefined}
        <Badge variant="outline" class="gap-1">
          TMDB Rating: {currentFilter.include.ratingMin}+
        </Badge>
      {/if}
      {#if currentFilter.include?.imdbRatingMin !== undefined}
        <Badge variant="outline" class="gap-1">
          IMDB Rating: {currentFilter.include.imdbRatingMin}+
        </Badge>
      {/if}
      <Button variant="ghost" size="sm" onclick={clearFilters} class="h-6 px-2 text-xs">
        Clear all
      </Button>
    </div>
  {/if}

  <!-- Movies Grid -->
  {#if allMovies.length === 0 && !isLoading}
    <div class="flex flex-col items-center justify-center py-12 text-center">
      <AlertCircle class="w-12 h-12 text-muted-foreground mb-4" />
      <h3 class="text-lg font-medium">No movies found</h3>
      <p class="text-muted-foreground text-sm mt-1">
        {#if data.syncStatus && !data.syncStatus.last_full_sync}
          Configure TMDB in Settings to populate the movie database.
        {:else}
          Try adjusting your search or filters.
        {/if}
      </p>
    </div>
  {:else}
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {#each allMovies as movie (movie.id)}
        <MovieCard
          {movie}
          radarrInstances={radarrTmdbMap[movie.id] || []}
          radarrConfigs={data.radarrConfigs}
        />
      {/each}
    </div>

    <!-- Infinite scroll trigger -->
    <div bind:this={loadMoreTrigger} class="flex justify-center py-8">
      {#if isLoading}
        <div class="flex items-center gap-2 text-muted-foreground">
          <Loader2 class="w-5 h-5 animate-spin" />
          <span>Loading more movies...</span>
        </div>
      {:else if hasMore}
        <Button variant="outline" onclick={loadMore}>Load more</Button>
      {:else if allMovies.length > 0}
        <p class="text-sm text-muted-foreground">
          Showing all {allMovies.length.toLocaleString()} results
        </p>
      {/if}
    </div>
  {/if}
</div>
