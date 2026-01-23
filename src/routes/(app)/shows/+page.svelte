<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { Search, Filter, RefreshCw, AlertCircle, X, Loader2 } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Badge } from '$lib/components/ui/badge';
  import * as Sheet from '$lib/components/ui/sheet';
  import ShowCard from '$lib/components/show-card.svelte';
  import FilterPanel from '$lib/components/filter-panel.svelte';
  import type { PageData } from './$types';
  import type { FilterConfig } from '$lib/types/filter';
  import type { Show } from '$lib/types';

  let { data }: { data: PageData } = $props();

  let searchInput = $state(data.currentSearch || '');
  let filterOpen = $state(false);
  let currentFilter = $state<FilterConfig>(data.currentFilter || { include: {}, exclude: {} });

  // Infinite scroll state
  let shows = $state<Show[]>(data.shows);
  let currentPage = $state(1);
  let isLoading = $state(false);
  let hasMore = $state(data.shows.length < data.total);
  let loadMoreTrigger = $state<HTMLDivElement | null>(null);

  // Sonarr library lookup - map of TVDB ID to instance info
  const sonarrTvdbMap = $derived(data.sonarrTvdbMap || {});

  // Reset shows when URL changes (search/filter)
  $effect(() => {
    shows = data.shows;
    currentPage = 1;
    hasMore = data.shows.length < data.total;
  });

  // Intersection Observer for infinite scroll
  $effect(() => {
    if (!loadMoreTrigger) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMore();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(loadMoreTrigger);

    return () => observer.disconnect();
  });

  async function loadMore() {
    if (isLoading || !hasMore) return;

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

      const response = await fetch(`/api/shows?${params}`);
      const result = await response.json();

      if (result.shows?.length > 0) {
        shows = [...shows, ...result.shows];
        currentPage = nextPage;
        hasMore = shows.length < result.total;
      } else {
        hasMore = false;
      }
    } catch (error) {
      console.error('Failed to load more shows:', error);
    } finally {
      isLoading = false;
    }
  }

  // Count active filters
  const activeFilterCount = $derived(() => {
    let count = 0;
    const inc = currentFilter.include;
    const exc = currentFilter.exclude;

    if (inc.languages?.length) count++;
    if (inc.genres?.length) count++;
    if (inc.status?.length) count++;
    if (inc.networks?.length) count++;
    if (inc.webChannels?.length) count++;
    if (inc.countries?.length) count++;
    if (inc.types?.length) count++;
    if (inc.ratingMin !== undefined || inc.ratingMax !== undefined) count++;
    if (inc.premieredAfter || inc.premieredBefore) count++;
    if (inc.runtimeMin !== undefined || inc.runtimeMax !== undefined) count++;

    if (exc.languages?.length) count++;
    if (exc.genres?.length) count++;
    if (exc.status?.length) count++;
    if (exc.networks?.length) count++;
    if (exc.webChannels?.length) count++;
    if (exc.countries?.length) count++;
    if (exc.types?.length) count++;

    return count;
  });

  function updateUrl(params: { search?: string; filter?: FilterConfig }) {
    const url = new URL($page.url);

    if (params.search !== undefined) {
      if (params.search) {
        url.searchParams.set('search', params.search);
      } else {
        url.searchParams.delete('search');
      }
    }

    if (params.filter !== undefined) {
      const hasFilters =
        Object.keys(params.filter.include).length > 0 ||
        Object.keys(params.filter.exclude).length > 0;
      if (hasFilters) {
        url.searchParams.set('filter', JSON.stringify(params.filter));
      } else {
        url.searchParams.delete('filter');
      }
    }

    goto(url.toString(), { keepFocus: true, invalidateAll: true });
  }

  function handleSearch(e: Event) {
    e.preventDefault();
    updateUrl({ search: searchInput });
  }

  function clearSearch() {
    searchInput = '';
    updateUrl({ search: '' });
  }

  function applyFilter(filter: FilterConfig) {
    currentFilter = filter;
    updateUrl({ filter });
    filterOpen = false;
  }

  function clearFilters() {
    currentFilter = { include: {}, exclude: {} };
    updateUrl({ filter: { include: {}, exclude: {} } });
  }
</script>

<div class="container mx-auto px-4 py-6 space-y-6">
  <!-- Header -->
  <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h1 class="text-2xl font-bold">Discover Shows</h1>
      <p class="text-muted-foreground text-sm">
        {data.total.toLocaleString()} shows available
        {#if data.syncStatus?.is_syncing}
          <span class="inline-flex items-center gap-1 text-yellow-500 ml-2">
            <RefreshCw class="w-3 h-3 animate-spin" />
            Syncing...
          </span>
        {/if}
      </p>
    </div>
  </div>

  <!-- Search and Filter Bar -->
  <div class="flex flex-col sm:flex-row gap-3">
    <form onsubmit={handleSearch} class="flex-1 flex gap-2">
      <div class="relative flex-1">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search shows..."
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

    <Sheet.Root bind:open={filterOpen}>
      <Sheet.Trigger>
        {#snippet child({ props })}
          <Button {...props} variant="outline" class="gap-2">
            <Filter class="w-4 h-4" />
            Filters
            {#if activeFilterCount() > 0}
              <Badge variant="secondary" class="ml-1 px-1.5 py-0 text-xs">
                {activeFilterCount()}
              </Badge>
            {/if}
          </Button>
        {/snippet}
      </Sheet.Trigger>
      <Sheet.Content side="right" class="w-full sm:max-w-lg overflow-y-auto">
        <Sheet.Header>
          <Sheet.Title>Filter Shows</Sheet.Title>
          <Sheet.Description>
            Use include filters to show matching results, exclude filters to hide them.
          </Sheet.Description>
        </Sheet.Header>
        <FilterPanel
          options={data.filterOptions}
          filter={currentFilter}
          onApply={applyFilter}
          onClear={clearFilters}
        />
      </Sheet.Content>
    </Sheet.Root>
  </div>

  <!-- Active filters display -->
  {#if activeFilterCount() > 0}
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-sm text-muted-foreground">Active filters:</span>
      {#if currentFilter.include.languages?.length}
        <Badge variant="outline" class="gap-1">
          Language: {currentFilter.include.languages.join(', ')}
        </Badge>
      {/if}
      {#if currentFilter.include.genres?.length}
        <Badge variant="outline" class="gap-1 bg-green-500/10">
          + Genres: {currentFilter.include.genres.join(', ')}
        </Badge>
      {/if}
      {#if currentFilter.exclude.genres?.length}
        <Badge variant="outline" class="gap-1 bg-red-500/10">
          - Genres: {currentFilter.exclude.genres.join(', ')}
        </Badge>
      {/if}
      {#if currentFilter.include.status?.length}
        <Badge variant="outline" class="gap-1">
          Status: {currentFilter.include.status.join(', ')}
        </Badge>
      {/if}
      {#if currentFilter.include.ratingMin !== undefined}
        <Badge variant="outline" class="gap-1">
          Rating: {currentFilter.include.ratingMin}+
        </Badge>
      {/if}
      <Button variant="ghost" size="sm" onclick={clearFilters} class="h-6 px-2 text-xs">
        Clear all
      </Button>
    </div>
  {/if}

  <!-- Shows Grid -->
  {#if shows.length === 0 && !isLoading}
    <div class="flex flex-col items-center justify-center py-12 text-center">
      <AlertCircle class="w-12 h-12 text-muted-foreground mb-4" />
      <h3 class="text-lg font-medium">No shows found</h3>
      <p class="text-muted-foreground text-sm mt-1">
        {#if data.syncStatus && !data.syncStatus.last_full_sync}
          The database is empty. Run <code class="bg-muted px-1 rounded">npm run sync</code> to fetch
          shows.
        {:else}
          Try adjusting your search or filters.
        {/if}
      </p>
    </div>
  {:else}
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {#each shows as show (show.id)}
        <ShowCard
          {show}
          sonarrInstances={show.thetvdb_id ? sonarrTvdbMap[show.thetvdb_id] || [] : []}
        />
      {/each}
    </div>

    <!-- Infinite scroll trigger -->
    <div bind:this={loadMoreTrigger} class="flex justify-center py-8">
      {#if isLoading}
        <div class="flex items-center gap-2 text-muted-foreground">
          <Loader2 class="w-5 h-5 animate-spin" />
          <span>Loading more shows...</span>
        </div>
      {:else if hasMore}
        <Button variant="outline" onclick={loadMore}>Load more</Button>
      {:else if shows.length > 0}
        <p class="text-sm text-muted-foreground">
          Showing all {shows.length.toLocaleString()} results
        </p>
      {/if}
    </div>
  {/if}
</div>
