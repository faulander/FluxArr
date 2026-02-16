<script lang="ts">
  import { RotateCcw } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import { Label } from '$lib/components/ui/label';
  import { Input } from '$lib/components/ui/input';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Separator } from '$lib/components/ui/separator';
  import type {
    MovieFilterConfig,
    MovieFilterInclude,
    MovieFilterExclude
  } from '$lib/types/filter';
  import MultiSelectFilter from './multi-select-filter.svelte';

  interface FilterOptions {
    languages: string[];
    genres: string[];
    status: string[];
    countries: string[];
  }

  interface Props {
    options: FilterOptions;
    filter: MovieFilterConfig;
    onApply: (filter: MovieFilterConfig) => void;
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
  let localInclude = $state<MovieFilterInclude>({ ...filter.include });
  let localExclude = $state<MovieFilterExclude>({ ...filter.exclude });
  let ratingMin = $state(filter.include.ratingMin?.toString() || '');
  let ratingMax = $state(filter.include.ratingMax?.toString() || '');
  let includeUnrated = $state(filter.include.includeUnrated ?? false);
  let imdbRatingMin = $state(filter.include.imdbRatingMin?.toString() || '');
  let imdbRatingMax = $state(filter.include.imdbRatingMax?.toString() || '');
  let includeImdbUnrated = $state(filter.include.includeImdbUnrated ?? false);
  let releasedAfter = $state(filter.include.releasedAfter || '');
  let releasedBefore = $state(filter.include.releasedBefore || '');
  let runtimeMin = $state(filter.include.runtimeMin?.toString() || '');
  let runtimeMax = $state(filter.include.runtimeMax?.toString() || '');

  function buildFilter(): MovieFilterConfig {
    const include: MovieFilterInclude = { ...localInclude };
    const exclude: MovieFilterExclude = { ...localExclude };

    if (ratingMin) include.ratingMin = parseFloat(ratingMin);
    else delete include.ratingMin;
    if (ratingMax) include.ratingMax = parseFloat(ratingMax);
    else delete include.ratingMax;
    include.includeUnrated = includeUnrated || undefined;

    if (imdbRatingMin) include.imdbRatingMin = parseFloat(imdbRatingMin);
    else delete include.imdbRatingMin;
    if (imdbRatingMax) include.imdbRatingMax = parseFloat(imdbRatingMax);
    else delete include.imdbRatingMax;
    include.includeImdbUnrated = includeImdbUnrated || undefined;

    if (releasedAfter) include.releasedAfter = releasedAfter;
    else delete include.releasedAfter;
    if (releasedBefore) include.releasedBefore = releasedBefore;
    else delete include.releasedBefore;

    if (runtimeMin) include.runtimeMin = parseInt(runtimeMin, 10);
    else delete include.runtimeMin;
    if (runtimeMax) include.runtimeMax = parseInt(runtimeMax, 10);
    else delete include.runtimeMax;

    // Clean empty arrays
    if (include.languages?.length === 0) delete include.languages;
    if (include.genres?.length === 0) delete include.genres;
    if (include.status?.length === 0) delete include.status;
    if (include.countries?.length === 0) delete include.countries;
    if (exclude.languages?.length === 0) delete exclude.languages;
    if (exclude.genres?.length === 0) delete exclude.genres;
    if (exclude.status?.length === 0) delete exclude.status;
    if (exclude.countries?.length === 0) delete exclude.countries;

    return { include, exclude };
  }

  function applyFilter() {
    onApply(buildFilter());
  }

  function clearFilter() {
    localInclude = {};
    localExclude = {};
    ratingMin = '';
    ratingMax = '';
    includeUnrated = false;
    imdbRatingMin = '';
    imdbRatingMax = '';
    includeImdbUnrated = false;
    releasedAfter = '';
    releasedBefore = '';
    runtimeMin = '';
    runtimeMax = '';
    onClear();
  }

  function maybeAutoApply() {
    if (autoApply) {
      onApply(buildFilter());
    }
  }
</script>

<div class="space-y-4">
  <!-- Languages -->
  <MultiSelectFilter
    label="Language"
    allOptions={options.languages}
    included={localInclude.languages || []}
    excluded={localExclude.languages || []}
    onIncludeChange={(items) => {
      localInclude.languages = items;
      maybeAutoApply();
    }}
    onExcludeChange={(items) => {
      localExclude.languages = items;
      maybeAutoApply();
    }}
  />

  <Separator />

  <!-- Genres -->
  <MultiSelectFilter
    label="Genres"
    allOptions={options.genres}
    included={localInclude.genres || []}
    excluded={localExclude.genres || []}
    onIncludeChange={(items) => {
      localInclude.genres = items;
      maybeAutoApply();
    }}
    onExcludeChange={(items) => {
      localExclude.genres = items;
      maybeAutoApply();
    }}
  />

  <Separator />

  <!-- Status -->
  <MultiSelectFilter
    label="Status"
    allOptions={options.status}
    included={localInclude.status || []}
    excluded={localExclude.status || []}
    onIncludeChange={(items) => {
      localInclude.status = items;
      maybeAutoApply();
    }}
    onExcludeChange={(items) => {
      maybeAutoApply();
    }}
  />

  <Separator />

  <!-- Countries -->
  {#if options.countries.length > 0}
    <MultiSelectFilter
      label="Countries"
      allOptions={options.countries}
      included={localInclude.countries || []}
      excluded={localExclude.countries || []}
      onIncludeChange={(items) => {
        localInclude.countries = items;
        maybeAutoApply();
      }}
      onExcludeChange={(items) => {
        localExclude.countries = items;
        maybeAutoApply();
      }}
    />

    <Separator />
  {/if}

  <!-- TMDB Rating -->
  <div>
    <Label class="text-sm font-medium mb-2 block">TMDB Rating</Label>
    <div class="grid grid-cols-2 gap-2">
      <Input
        type="number"
        placeholder="Min (0)"
        min="0"
        max="10"
        step="0.1"
        bind:value={ratingMin}
        onchange={maybeAutoApply}
      />
      <Input
        type="number"
        placeholder="Max (10)"
        min="0"
        max="10"
        step="0.1"
        bind:value={ratingMax}
        onchange={maybeAutoApply}
      />
    </div>
    <div class="flex items-center gap-2 mt-2">
      <Checkbox
        id="include-unrated"
        checked={includeUnrated}
        onCheckedChange={(checked) => {
          includeUnrated = checked === true;
          maybeAutoApply();
        }}
      />
      <Label for="include-unrated" class="text-sm">Include unrated movies</Label>
    </div>
  </div>

  <Separator />

  <!-- IMDB Rating -->
  <div>
    <Label class="text-sm font-medium mb-2 block">IMDB Rating</Label>
    <div class="grid grid-cols-2 gap-2">
      <Input
        type="number"
        placeholder="Min (0)"
        min="0"
        max="10"
        step="0.1"
        bind:value={imdbRatingMin}
        onchange={maybeAutoApply}
      />
      <Input
        type="number"
        placeholder="Max (10)"
        min="0"
        max="10"
        step="0.1"
        bind:value={imdbRatingMax}
        onchange={maybeAutoApply}
      />
    </div>
    <div class="flex items-center gap-2 mt-2">
      <Checkbox
        id="include-imdb-unrated"
        checked={includeImdbUnrated}
        onCheckedChange={(checked) => {
          includeImdbUnrated = checked === true;
          maybeAutoApply();
        }}
      />
      <Label for="include-imdb-unrated" class="text-sm">Include movies without IMDB rating</Label>
    </div>
  </div>

  <Separator />

  <!-- Release Date -->
  <div>
    <Label class="text-sm font-medium mb-2 block">Release Date</Label>
    <div class="grid grid-cols-2 gap-2">
      <div>
        <Label class="text-xs text-muted-foreground">After</Label>
        <Input type="date" bind:value={releasedAfter} onchange={maybeAutoApply} />
      </div>
      <div>
        <Label class="text-xs text-muted-foreground">Before</Label>
        <Input type="date" bind:value={releasedBefore} onchange={maybeAutoApply} />
      </div>
    </div>
  </div>

  <Separator />

  <!-- Runtime -->
  <div>
    <Label class="text-sm font-medium mb-2 block">Runtime (minutes)</Label>
    <div class="grid grid-cols-2 gap-2">
      <Input
        type="number"
        placeholder="Min"
        min="0"
        bind:value={runtimeMin}
        onchange={maybeAutoApply}
      />
      <Input
        type="number"
        placeholder="Max"
        min="0"
        bind:value={runtimeMax}
        onchange={maybeAutoApply}
      />
    </div>
  </div>

  <!-- Buttons -->
  {#if showButtons}
    <Separator />
    <div class="flex gap-2">
      <Button variant="outline" class="flex-1" onclick={clearFilter}>
        <RotateCcw class="w-4 h-4 mr-2" />
        Clear
      </Button>
      <Button class="flex-1" onclick={applyFilter}>Apply Filter</Button>
    </div>
  {/if}
</div>
