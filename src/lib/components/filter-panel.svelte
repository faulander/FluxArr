<script lang="ts">
  import { RotateCcw } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import { Label } from '$lib/components/ui/label';
  import { Input } from '$lib/components/ui/input';
  import { Separator } from '$lib/components/ui/separator';
  import { cn } from '$lib/utils';
  import type { FilterConfig, FilterInclude, FilterExclude } from '$lib/types/filter';
  import MultiSelectFilter from './multi-select-filter.svelte';

  interface FilterOptions {
    languages: string[];
    genres: string[];
    status: string[];
    networks: string[];
    webChannels: string[];
    countries: string[];
    types: string[];
  }

  interface Props {
    options: FilterOptions;
    filter: FilterConfig;
    onApply: (filter: FilterConfig) => void;
    onClear: () => void;
    showButtons?: boolean;
    autoApply?: boolean;
  }

  let {
    options,
    filter,
    onApply,
    onClear,
    showButtons = true,
    autoApply = false
  }: Props = $props();

  // Local state for editing
  let localInclude = $state<FilterInclude>({ ...filter.include });
  let localExclude = $state<FilterExclude>({ ...filter.exclude });
  let ratingMin = $state(filter.include.ratingMin?.toString() || '');
  let ratingMax = $state(filter.include.ratingMax?.toString() || '');
  let premieredAfter = $state(filter.include.premieredAfter || '');
  let premieredBefore = $state(filter.include.premieredBefore || '');

  // Auto-apply when in managed mode (for dialogs)
  $effect(() => {
    if (autoApply) {
      // Build and apply filter config whenever local state changes
      const finalFilter: FilterConfig = {
        include: { ...localInclude },
        exclude: { ...localExclude }
      };

      if (ratingMin) {
        const val = parseFloat(ratingMin);
        if (!isNaN(val) && val >= 0 && val <= 10) {
          finalFilter.include.ratingMin = val;
        }
      }
      if (ratingMax) {
        const val = parseFloat(ratingMax);
        if (!isNaN(val) && val >= 0 && val <= 10) {
          finalFilter.include.ratingMax = val;
        }
      }
      if (premieredAfter) {
        finalFilter.include.premieredAfter = premieredAfter;
      }
      if (premieredBefore) {
        finalFilter.include.premieredBefore = premieredBefore;
      }

      // Clean up empty arrays
      for (const key of Object.keys(finalFilter.include) as (keyof FilterInclude)[]) {
        const val = finalFilter.include[key];
        if (Array.isArray(val) && val.length === 0) {
          delete finalFilter.include[key];
        }
      }
      for (const key of Object.keys(finalFilter.exclude) as (keyof FilterExclude)[]) {
        const val = finalFilter.exclude[key];
        if (Array.isArray(val) && val.length === 0) {
          delete finalFilter.exclude[key];
        }
      }

      onApply(finalFilter);
    }
  });

  function handleApply() {
    const finalFilter: FilterConfig = {
      include: { ...localInclude },
      exclude: { ...localExclude }
    };

    // Parse rating inputs
    if (ratingMin) {
      const val = parseFloat(ratingMin);
      if (!isNaN(val) && val >= 0 && val <= 10) {
        finalFilter.include.ratingMin = val;
      }
    }
    if (ratingMax) {
      const val = parseFloat(ratingMax);
      if (!isNaN(val) && val >= 0 && val <= 10) {
        finalFilter.include.ratingMax = val;
      }
    }

    // Parse premiered date inputs
    if (premieredAfter) {
      finalFilter.include.premieredAfter = premieredAfter;
    }
    if (premieredBefore) {
      finalFilter.include.premieredBefore = premieredBefore;
    }

    // Clean up empty arrays
    for (const key of Object.keys(finalFilter.include) as (keyof FilterInclude)[]) {
      const val = finalFilter.include[key];
      if (Array.isArray(val) && val.length === 0) {
        delete finalFilter.include[key];
      }
    }
    for (const key of Object.keys(finalFilter.exclude) as (keyof FilterExclude)[]) {
      const val = finalFilter.exclude[key];
      if (Array.isArray(val) && val.length === 0) {
        delete finalFilter.exclude[key];
      }
    }

    onApply(finalFilter);
  }

  function handleClear() {
    localInclude = {};
    localExclude = {};
    ratingMin = '';
    ratingMax = '';
    premieredAfter = '';
    premieredBefore = '';
    onClear();
  }
</script>

<div class="py-4 space-y-6">
  <!-- Language -->
  <MultiSelectFilter
    label="Language"
    allOptions={options.languages}
    included={localInclude.languages || []}
    excluded={localExclude.languages || []}
    onIncludeChange={(items) => (localInclude.languages = items)}
    onExcludeChange={(items) => (localExclude.languages = items)}
  />

  <Separator />

  <!-- Genres -->
  <MultiSelectFilter
    label="Genres"
    allOptions={options.genres}
    included={localInclude.genres || []}
    excluded={localExclude.genres || []}
    onIncludeChange={(items) => (localInclude.genres = items)}
    onExcludeChange={(items) => (localExclude.genres = items)}
  />

  <Separator />

  <!-- Status -->
  <MultiSelectFilter
    label="Status"
    allOptions={options.status}
    included={localInclude.status || []}
    excluded={localExclude.status || []}
    onIncludeChange={(items) => (localInclude.status = items)}
    onExcludeChange={(items) => (localExclude.status = items)}
  />

  <Separator />

  <!-- Rating -->
  <div class="space-y-3">
    <Label class="text-sm font-medium">Rating</Label>
    <div class="flex items-center gap-3">
      <div class="flex-1">
        <Label class="text-xs text-muted-foreground">Min</Label>
        <Input
          type="number"
          min="0"
          max="10"
          step="0.1"
          placeholder="0"
          bind:value={ratingMin}
          class="mt-1"
        />
      </div>
      <div class="flex-1">
        <Label class="text-xs text-muted-foreground">Max</Label>
        <Input
          type="number"
          min="0"
          max="10"
          step="0.1"
          placeholder="10"
          bind:value={ratingMax}
          class="mt-1"
        />
      </div>
    </div>
  </div>

  <Separator />

  <!-- Premiered Date (First Aired) -->
  <div class="space-y-3">
    <Label class="text-sm font-medium">First Aired Date</Label>
    <div class="flex items-center gap-3">
      <div class="flex-1">
        <Label class="text-xs text-muted-foreground">After</Label>
        <Input type="date" bind:value={premieredAfter} class="mt-1" />
      </div>
      <div class="flex-1">
        <Label class="text-xs text-muted-foreground">Before</Label>
        <Input type="date" bind:value={premieredBefore} class="mt-1" />
      </div>
    </div>
  </div>

  <Separator />

  <!-- Type -->
  <MultiSelectFilter
    label="Type"
    allOptions={options.types}
    included={localInclude.types || []}
    excluded={localExclude.types || []}
    onIncludeChange={(items) => (localInclude.types = items)}
    onExcludeChange={(items) => (localExclude.types = items)}
  />

  <Separator />

  <!-- Networks -->
  {#if options.networks.length > 0}
    <MultiSelectFilter
      label="Networks"
      allOptions={options.networks}
      included={localInclude.networks || []}
      excluded={localExclude.networks || []}
      onIncludeChange={(items) => (localInclude.networks = items)}
      onExcludeChange={(items) => (localExclude.networks = items)}
    />
    <Separator />
  {/if}

  <!-- Streaming Services -->
  {#if options.webChannels.length > 0}
    <MultiSelectFilter
      label="Streaming Services"
      allOptions={options.webChannels}
      included={localInclude.webChannels || []}
      excluded={localExclude.webChannels || []}
      onIncludeChange={(items) => (localInclude.webChannels = items)}
      onExcludeChange={(items) => (localExclude.webChannels = items)}
    />
    <Separator />
  {/if}

  <!-- Action buttons -->
  {#if showButtons}
    <div class="flex gap-3 pt-2">
      <Button variant="outline" onclick={handleClear} class="flex-1 gap-2">
        <RotateCcw class="w-4 h-4" />
        Clear
      </Button>
      <Button onclick={handleApply} class="flex-1">Apply Filters</Button>
    </div>
  {/if}
</div>
