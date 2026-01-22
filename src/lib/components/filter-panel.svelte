<script lang="ts">
  import { Plus, Minus, RotateCcw } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import { Label } from '$lib/components/ui/label';
  import { Input } from '$lib/components/ui/input';
  import { Badge } from '$lib/components/ui/badge';
  import { Separator } from '$lib/components/ui/separator';
  import * as Select from '$lib/components/ui/select';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import { cn } from '$lib/utils';
  import type { FilterConfig, FilterInclude, FilterExclude } from '$lib/types/filter';

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
  }

  let { options, filter, onApply, onClear }: Props = $props();

  // Local state for editing
  let localInclude = $state<FilterInclude>({ ...filter.include });
  let localExclude = $state<FilterExclude>({ ...filter.exclude });
  let ratingMin = $state(filter.include.ratingMin?.toString() || '');
  let ratingMax = $state(filter.include.ratingMax?.toString() || '');

  function toggleArrayItem<T extends string>(
    arr: T[] | undefined,
    item: T,
    setFn: (newArr: T[]) => void
  ) {
    const current = arr || [];
    if (current.includes(item)) {
      setFn(current.filter((i) => i !== item));
    } else {
      setFn([...current, item]);
    }
  }

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
    onClear();
  }

  // Filter section component
  interface MultiSelectProps {
    label: string;
    allOptions: string[];
    included: string[];
    excluded: string[];
    onIncludeChange: (items: string[]) => void;
    onExcludeChange: (items: string[]) => void;
  }
</script>

{#snippet MultiSelect(props: MultiSelectProps)}
  <div class="space-y-3">
    <Label class="text-sm font-medium">{props.label}</Label>

    <div class="space-y-2">
      <!-- Include section -->
      <div class="flex items-center gap-2 text-xs text-muted-foreground">
        <Plus class="w-3 h-3 text-green-500" />
        <span>Include (show matching)</span>
      </div>
      <div class="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
        {#each props.allOptions.slice(0, 50) as option}
          {@const isIncluded = props.included.includes(option)}
          {@const isExcluded = props.excluded.includes(option)}
          <button
            type="button"
            onclick={() => {
              if (isIncluded) {
                props.onIncludeChange(props.included.filter(i => i !== option));
              } else {
                // Remove from exclude if adding to include
                if (isExcluded) {
                  props.onExcludeChange(props.excluded.filter(i => i !== option));
                }
                props.onIncludeChange([...props.included, option]);
              }
            }}
            class={cn(
              'px-2 py-0.5 text-xs rounded-md border transition-colors',
              isIncluded
                ? 'bg-green-500/20 border-green-500/50 text-green-700 dark:text-green-300'
                : 'hover:bg-muted'
            )}
          >
            {option}
          </button>
        {/each}
      </div>

      <!-- Exclude section -->
      <div class="flex items-center gap-2 text-xs text-muted-foreground mt-3">
        <Minus class="w-3 h-3 text-red-500" />
        <span>Exclude (hide matching)</span>
      </div>
      <div class="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
        {#each props.allOptions.slice(0, 50) as option}
          {@const isIncluded = props.included.includes(option)}
          {@const isExcluded = props.excluded.includes(option)}
          <button
            type="button"
            onclick={() => {
              if (isExcluded) {
                props.onExcludeChange(props.excluded.filter(i => i !== option));
              } else {
                // Remove from include if adding to exclude
                if (isIncluded) {
                  props.onIncludeChange(props.included.filter(i => i !== option));
                }
                props.onExcludeChange([...props.excluded, option]);
              }
            }}
            class={cn(
              'px-2 py-0.5 text-xs rounded-md border transition-colors',
              isExcluded
                ? 'bg-red-500/20 border-red-500/50 text-red-700 dark:text-red-300'
                : 'hover:bg-muted'
            )}
          >
            {option}
          </button>
        {/each}
      </div>
    </div>
  </div>
{/snippet}

<div class="py-4 space-y-6">
  <!-- Language -->
  {@render MultiSelect({
    label: 'Language',
    allOptions: options.languages,
    included: localInclude.languages || [],
    excluded: localExclude.languages || [],
    onIncludeChange: (items) => localInclude.languages = items,
    onExcludeChange: (items) => localExclude.languages = items
  })}

  <Separator />

  <!-- Genres -->
  {@render MultiSelect({
    label: 'Genres',
    allOptions: options.genres,
    included: localInclude.genres || [],
    excluded: localExclude.genres || [],
    onIncludeChange: (items) => localInclude.genres = items,
    onExcludeChange: (items) => localExclude.genres = items
  })}

  <Separator />

  <!-- Status -->
  {@render MultiSelect({
    label: 'Status',
    allOptions: options.status,
    included: localInclude.status || [],
    excluded: localExclude.status || [],
    onIncludeChange: (items) => localInclude.status = items,
    onExcludeChange: (items) => localExclude.status = items
  })}

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

  <!-- Type -->
  {@render MultiSelect({
    label: 'Type',
    allOptions: options.types,
    included: localInclude.types || [],
    excluded: localExclude.types || [],
    onIncludeChange: (items) => localInclude.types = items,
    onExcludeChange: (items) => localExclude.types = items
  })}

  <Separator />

  <!-- Networks -->
  {#if options.networks.length > 0}
    {@render MultiSelect({
      label: 'Networks',
      allOptions: options.networks,
      included: localInclude.networks || [],
      excluded: localExclude.networks || [],
      onIncludeChange: (items) => localInclude.networks = items,
      onExcludeChange: (items) => localExclude.networks = items
    })}
    <Separator />
  {/if}

  <!-- Streaming Services -->
  {#if options.webChannels.length > 0}
    {@render MultiSelect({
      label: 'Streaming Services',
      allOptions: options.webChannels,
      included: localInclude.webChannels || [],
      excluded: localExclude.webChannels || [],
      onIncludeChange: (items) => localInclude.webChannels = items,
      onExcludeChange: (items) => localExclude.webChannels = items
    })}
    <Separator />
  {/if}

  <!-- Action buttons -->
  <div class="flex gap-3 pt-2">
    <Button variant="outline" onclick={handleClear} class="flex-1 gap-2">
      <RotateCcw class="w-4 h-4" />
      Clear
    </Button>
    <Button onclick={handleApply} class="flex-1">
      Apply Filters
    </Button>
  </div>
</div>
