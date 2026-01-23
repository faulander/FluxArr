<script lang="ts">
  import { Star, Calendar, Tv, Globe, Check } from '@lucide/svelte';
  import { Badge } from '$lib/components/ui/badge';
  import * as Card from '$lib/components/ui/card';
  import { cn } from '$lib/utils';
  import type { Show } from '$lib/types';

  interface Props {
    show: Show;
    inSonarr?: boolean;
    class?: string;
  }

  let { show, inSonarr = false, class: className }: Props = $props();

  const genres = $derived(() => {
    try {
      return JSON.parse(show.genres || '[]').slice(0, 3);
    } catch {
      return [];
    }
  });

  const statusColor = $derived(() => {
    switch (show.status) {
      case 'Running':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'Ended':
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
      case 'To Be Determined':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'In Development':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  });

  const network = $derived(show.network_name || show.web_channel_name || 'Unknown');
  const year = $derived(show.premiered ? new Date(show.premiered).getFullYear() : null);
</script>

<a href="/shows/{show.id}" class={cn('block group', className)}>
  <Card.Root class="overflow-hidden transition-all hover:ring-2 hover:ring-primary/50 h-full">
    <div class="relative aspect-[2/3] bg-muted">
      {#if show.image_medium}
        <img
          src={show.image_medium}
          alt={show.name}
          class="object-cover w-full h-full transition-transform group-hover:scale-105"
          loading="lazy"
        />
      {:else}
        <div class="flex items-center justify-center w-full h-full text-muted-foreground">
          <Tv class="w-12 h-12" />
        </div>
      {/if}

      <!-- Rating badge -->
      {#if show.rating_average}
        <div
          class="absolute top-2 right-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm text-white text-xs font-medium px-2 py-1 rounded"
        >
          <Star class="w-3 h-3 fill-yellow-400 text-yellow-400" />
          {show.rating_average.toFixed(1)}
        </div>
      {/if}

      <!-- Status badge -->
      <div class="absolute top-2 left-2">
        <Badge variant="outline" class={cn('text-xs border', statusColor())}>
          {show.status}
        </Badge>
      </div>

      <!-- In Sonarr indicator -->
      {#if inSonarr}
        <div
          class="absolute bottom-2 right-2 flex items-center gap-1 bg-green-600 text-white text-xs font-medium px-2 py-1 rounded"
          title="In Sonarr"
        >
          <Check class="w-3 h-3" />
          <span>Sonarr</span>
        </div>
      {/if}
    </div>

    <Card.Content class="p-3 space-y-2">
      <h3
        class="font-semibold text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors"
      >
        {show.name}
      </h3>

      <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {#if year}
          <span class="flex items-center gap-1">
            <Calendar class="w-3 h-3" />
            {year}
          </span>
        {/if}
        <span class="flex items-center gap-1 truncate">
          <Globe class="w-3 h-3 shrink-0" />
          <span class="truncate">{network}</span>
        </span>
      </div>

      {#if genres().length > 0}
        <div class="flex flex-wrap gap-1">
          {#each genres() as genre}
            <Badge variant="secondary" class="text-xs px-1.5 py-0">
              {genre}
            </Badge>
          {/each}
        </div>
      {/if}
    </Card.Content>
  </Card.Root>
</a>
