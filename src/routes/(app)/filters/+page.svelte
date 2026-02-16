<script lang="ts">
  import { goto } from '$app/navigation';
  import { toast } from 'svelte-sonner';
  import { Filter, Plus, Trash2, Star, Pencil, Play, Loader2, Tv, Film } from '@lucide/svelte';
  import * as Card from '$lib/components/ui/card';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Badge } from '$lib/components/ui/badge';
  import { Separator } from '$lib/components/ui/separator';
  import FilterPanel from '$lib/components/filter-panel.svelte';
  import MovieFilterPanel from '$lib/components/movie-filter-panel.svelte';
  import type { PageData } from './$types';
  import type { FilterConfig, MovieFilterConfig, SavedFilter } from '$lib/types/filter';

  let { data }: { data: PageData } = $props();

  let filters = $state<SavedFilter[]>(data.filters);

  // Content type toggle
  let activeTab = $state<'show' | 'movie'>('show');

  let filteredFilters = $derived(filters.filter((f) => (f.content_type || 'show') === activeTab));

  // Dialog state
  let createDialogOpen = $state(false);
  let editDialogOpen = $state(false);
  let deleteDialogOpen = $state(false);

  // Form state
  let filterName = $state('');
  let showFilterConfig = $state<FilterConfig>({ include: {}, exclude: {} });
  let movieFilterConfig = $state<MovieFilterConfig>({ include: {}, exclude: {} });
  let isDefault = $state(false);
  let isSaving = $state(false);
  let editingFilter = $state<SavedFilter | null>(null);
  let deletingFilter = $state<SavedFilter | null>(null);

  function resetForm() {
    filterName = '';
    showFilterConfig = { include: {}, exclude: {} };
    movieFilterConfig = { include: {}, exclude: {} };
    isDefault = false;
    editingFilter = null;
  }

  function openEditDialog(filter: SavedFilter) {
    editingFilter = filter;
    filterName = filter.name;
    const config = JSON.parse(filter.config);
    if ((filter.content_type || 'show') === 'movie') {
      movieFilterConfig = config;
    } else {
      showFilterConfig = config;
    }
    isDefault = filter.is_default === 1;
    editDialogOpen = true;
  }

  function openDeleteDialog(filter: SavedFilter) {
    deletingFilter = filter;
    deleteDialogOpen = true;
  }

  async function createFilter() {
    if (!filterName.trim()) {
      toast.error('Please enter a filter name');
      return;
    }

    isSaving = true;

    const config = activeTab === 'movie' ? movieFilterConfig : showFilterConfig;

    try {
      const response = await fetch('/api/filters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: filterName.trim(),
          config,
          isDefault,
          contentType: activeTab
        })
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'Failed to create filter');
        return;
      }

      // Update local state
      if (isDefault) {
        filters = filters.map((f) =>
          (f.content_type || 'show') === activeTab ? { ...f, is_default: 0 } : f
        );
      }
      filters = [...filters, result.filter];

      toast.success('Filter created');
      createDialogOpen = false;
      resetForm();
    } catch {
      toast.error('Failed to create filter');
    } finally {
      isSaving = false;
    }
  }

  async function updateFilter() {
    if (!editingFilter) return;
    if (!filterName.trim()) {
      toast.error('Please enter a filter name');
      return;
    }

    isSaving = true;

    const contentType = editingFilter.content_type || 'show';
    const config = contentType === 'movie' ? movieFilterConfig : showFilterConfig;

    try {
      const response = await fetch(`/api/filters/${editingFilter.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: filterName.trim(),
          config,
          isDefault
        })
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'Failed to update filter');
        return;
      }

      // Update local state
      if (isDefault) {
        filters = filters.map((f) =>
          (f.content_type || 'show') === contentType
            ? { ...f, is_default: f.id === editingFilter!.id ? 1 : 0 }
            : f
        );
      }
      filters = filters.map((f) => (f.id === editingFilter!.id ? result.filter : f));

      toast.success('Filter updated');
      editDialogOpen = false;
      resetForm();
    } catch {
      toast.error('Failed to update filter');
    } finally {
      isSaving = false;
    }
  }

  async function deleteFilter() {
    if (!deletingFilter) return;

    try {
      const response = await fetch(`/api/filters/${deletingFilter.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const result = await response.json();
        toast.error(result.error || 'Failed to delete filter');
        return;
      }

      filters = filters.filter((f) => f.id !== deletingFilter!.id);
      toast.success('Filter deleted');
      deleteDialogOpen = false;
      deletingFilter = null;
    } catch {
      toast.error('Failed to delete filter');
    }
  }

  async function setAsDefault(filter: SavedFilter) {
    try {
      const response = await fetch(`/api/filters/${filter.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true })
      });

      if (!response.ok) {
        toast.error('Failed to set default filter');
        return;
      }

      const contentType = filter.content_type || 'show';
      filters = filters.map((f) =>
        (f.content_type || 'show') === contentType
          ? { ...f, is_default: f.id === filter.id ? 1 : 0 }
          : f
      );
      toast.success('Default filter updated');
    } catch {
      toast.error('Failed to set default filter');
    }
  }

  function applyFilter(filter: SavedFilter) {
    const config = JSON.parse(filter.config);
    const params = new URLSearchParams();
    params.set('filter', JSON.stringify(config));
    const contentType = filter.content_type || 'show';
    goto(`/${contentType === 'movie' ? 'movies' : 'shows'}?${params.toString()}`);
  }

  function getFilterSummary(filter: SavedFilter): string[] {
    const config = JSON.parse(filter.config);
    const parts: string[] = [];

    if (config.include.languages?.length) {
      parts.push(`Language: ${config.include.languages.join(', ')}`);
    }
    if (config.include.genres?.length) {
      parts.push(`+Genres: ${config.include.genres.join(', ')}`);
    }
    if (config.exclude.genres?.length) {
      parts.push(`-Genres: ${config.exclude.genres.join(', ')}`);
    }
    if (config.include.status?.length) {
      parts.push(`Status: ${config.include.status.join(', ')}`);
    }
    if (config.include.countries?.length) {
      parts.push(`Countries: ${config.include.countries.join(', ')}`);
    }
    if (config.include.ratingMin !== undefined) {
      parts.push(`Rating: ${config.include.ratingMin}+`);
    }
    if (config.include.imdbRatingMin !== undefined) {
      parts.push(`IMDB: ${config.include.imdbRatingMin}+`);
    }
    if (config.include.premieredAfter || config.include.releasedAfter) {
      parts.push(`After: ${config.include.premieredAfter || config.include.releasedAfter}`);
    }
    if (config.include.premieredBefore || config.include.releasedBefore) {
      parts.push(`Before: ${config.include.premieredBefore || config.include.releasedBefore}`);
    }
    if (config.include.runtimeMin !== undefined) {
      parts.push(`Runtime: ${config.include.runtimeMin}+ min`);
    }

    return parts.length > 0 ? parts : ['No filters configured'];
  }
</script>

<div class="container mx-auto px-4 py-6 max-w-4xl space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold">Saved Filters</h1>
      <p class="text-muted-foreground text-sm">Create and manage your filter presets</p>
    </div>
    <Dialog.Root
      bind:open={createDialogOpen}
      onOpenChange={(open) => {
        if (open) resetForm();
      }}
    >
      <Dialog.Trigger>
        {#snippet child({ props })}
          <Button {...props} class="gap-2">
            <Plus class="w-4 h-4" />
            New Filter
          </Button>
        {/snippet}
      </Dialog.Trigger>
      <Dialog.Content class="max-w-2xl max-h-[90vh] overflow-y-auto">
        <Dialog.Header>
          <Dialog.Title>Create New {activeTab === 'movie' ? 'Movie' : 'Show'} Filter</Dialog.Title>
          <Dialog.Description>
            Configure your filter settings and save them for quick access.
          </Dialog.Description>
        </Dialog.Header>

        <div class="space-y-4 py-4">
          <div class="space-y-2">
            <Label for="filter-name">Filter Name</Label>
            <Input id="filter-name" bind:value={filterName} placeholder="My Filter" />
          </div>

          <Separator />

          {#if activeTab === 'movie'}
            <MovieFilterPanel
              options={data.movieFilterOptions}
              filter={movieFilterConfig}
              onApply={(config) => (movieFilterConfig = config)}
              onClear={() => (movieFilterConfig = { include: {}, exclude: {} })}
              showButtons={false}
              autoApply={true}
            />
          {:else}
            <FilterPanel
              options={data.filterOptions}
              filter={showFilterConfig}
              onApply={(config) => (showFilterConfig = config)}
              onClear={() => (showFilterConfig = { include: {}, exclude: {} })}
              showButtons={false}
              autoApply={true}
            />
          {/if}
        </div>

        <Dialog.Footer>
          <Button variant="outline" onclick={() => (createDialogOpen = false)}>Cancel</Button>
          <Button onclick={createFilter} disabled={isSaving}>
            {#if isSaving}
              <Loader2 class="w-4 h-4 mr-2 animate-spin" />
              Creating...
            {:else}
              Create Filter
            {/if}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
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

  {#if filteredFilters.length === 0}
    <Card.Root>
      <Card.Content class="py-12 text-center">
        <Filter class="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <h3 class="text-lg font-medium">No saved {activeTab} filters yet</h3>
        <p class="text-muted-foreground text-sm mt-1">
          Create filter presets to quickly apply your favorite filter combinations.
        </p>
        <Button class="mt-4 gap-2" onclick={() => (createDialogOpen = true)}>
          <Plus class="w-4 h-4" />
          Create Your First Filter
        </Button>
      </Card.Content>
    </Card.Root>
  {:else}
    <div class="grid gap-4">
      {#each filteredFilters as filter (filter.id)}
        <Card.Root>
          <Card.Content class="p-4">
            <div class="flex items-start justify-between gap-4">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <h3 class="font-semibold truncate">{filter.name}</h3>
                  {#if filter.is_default}
                    <Badge variant="secondary" class="gap-1">
                      <Star class="w-3 h-3 fill-current" />
                      Default
                    </Badge>
                  {/if}
                </div>
                <div class="flex flex-wrap gap-1.5 mt-2">
                  {#each getFilterSummary(filter) as part}
                    <Badge variant="outline" class="text-xs">{part}</Badge>
                  {/each}
                </div>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onclick={() => applyFilter(filter)}
                  class="gap-1"
                >
                  <Play class="w-3 h-3" />
                  Apply
                </Button>
                <Button variant="ghost" size="icon" onclick={() => openEditDialog(filter)}>
                  <Pencil class="w-4 h-4" />
                </Button>
                {#if !filter.is_default}
                  <Button variant="ghost" size="icon" onclick={() => setAsDefault(filter)}>
                    <Star class="w-4 h-4" />
                  </Button>
                {/if}
                <Button variant="ghost" size="icon" onclick={() => openDeleteDialog(filter)}>
                  <Trash2 class="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          </Card.Content>
        </Card.Root>
      {/each}
    </div>
  {/if}
</div>

<!-- Edit Filter Dialog -->
<Dialog.Root bind:open={editDialogOpen}>
  <Dialog.Content class="max-w-2xl max-h-[90vh] overflow-y-auto">
    <Dialog.Header>
      <Dialog.Title>Edit Filter</Dialog.Title>
      <Dialog.Description>Update your filter settings.</Dialog.Description>
    </Dialog.Header>

    <div class="space-y-4 py-4">
      <div class="space-y-2">
        <Label for="edit-filter-name">Filter Name</Label>
        <Input id="edit-filter-name" bind:value={filterName} placeholder="My Filter" />
      </div>

      <Separator />

      {#if editingFilter && (editingFilter.content_type || 'show') === 'movie'}
        <MovieFilterPanel
          options={data.movieFilterOptions}
          filter={movieFilterConfig}
          onApply={(config) => (movieFilterConfig = config)}
          onClear={() => (movieFilterConfig = { include: {}, exclude: {} })}
          showButtons={false}
          autoApply={true}
        />
      {:else}
        <FilterPanel
          options={data.filterOptions}
          filter={showFilterConfig}
          onApply={(config) => (showFilterConfig = config)}
          onClear={() => (showFilterConfig = { include: {}, exclude: {} })}
          showButtons={false}
          autoApply={true}
        />
      {/if}
    </div>

    <Dialog.Footer>
      <Button variant="outline" onclick={() => (editDialogOpen = false)}>Cancel</Button>
      <Button onclick={updateFilter} disabled={isSaving}>
        {#if isSaving}
          <Loader2 class="w-4 h-4 mr-2 animate-spin" />
          Saving...
        {:else}
          Save Changes
        {/if}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<!-- Delete Confirmation Dialog -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Delete Filter</AlertDialog.Title>
      <AlertDialog.Description>
        Are you sure you want to delete "{deletingFilter?.name}"? This action cannot be undone.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action onclick={deleteFilter}>Delete</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
