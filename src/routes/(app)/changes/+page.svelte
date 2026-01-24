<script lang="ts">
  import {
    History,
    Tv,
    Star,
    Clock,
    ArrowRight,
    ChevronLeft,
    ChevronRight,
    Plus,
    RefreshCw
  } from '@lucide/svelte';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr + 'Z');
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    }
    if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    }
    if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    }

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function getChangeIcon(changeType: string) {
    switch (changeType) {
      case 'new':
        return Plus;
      case 'ended':
      case 'status_change':
        return RefreshCw;
      case 'rating_change':
        return Star;
      default:
        return RefreshCw;
    }
  }

  function getChangeBadgeVariant(
    changeType: string
  ): 'default' | 'secondary' | 'destructive' | 'outline' {
    switch (changeType) {
      case 'new':
        return 'default';
      case 'ended':
        return 'destructive';
      case 'rating_change':
        return 'secondary';
      default:
        return 'outline';
    }
  }

  function getChangeLabel(changeType: string): string {
    switch (changeType) {
      case 'new':
        return 'New Show';
      case 'ended':
        return 'Ended';
      case 'status_change':
        return 'Status Changed';
      case 'rating_change':
        return 'Rating Changed';
      case 'updated':
        return 'Updated';
      default:
        return changeType;
    }
  }

  function getChangeDescription(change: (typeof data.changes)[0]): string {
    switch (change.changeType) {
      case 'new':
        return 'Added to database';
      case 'ended':
        return `Status changed from "${change.oldValue}" to "Ended"`;
      case 'status_change':
        return `Status: "${change.oldValue}" → "${change.newValue}"`;
      case 'rating_change':
        if (!change.oldValue) {
          return `Rating added: ${parseFloat(change.newValue!).toFixed(1)}`;
        }
        const oldRating = parseFloat(change.oldValue);
        const newRating = parseFloat(change.newValue!);
        const direction = newRating > oldRating ? '↑' : '↓';
        return `Rating: ${oldRating.toFixed(1)} → ${newRating.toFixed(1)} ${direction}`;
      case 'updated':
        if (change.fieldName === 'name') {
          return `Renamed from "${change.oldValue}"`;
        }
        if (change.fieldName === 'network') {
          return `Network: ${change.oldValue || 'None'} → ${change.newValue}`;
        }
        if (change.fieldName === 'premiered') {
          return `Premiere date set: ${change.newValue}`;
        }
        return `${change.fieldName}: ${change.oldValue || 'None'} → ${change.newValue}`;
      default:
        return `${change.fieldName || 'Unknown'} changed`;
    }
  }

  // Group changes by date
  const groupedChanges = $derived.by(() => {
    const groups: Map<string, typeof data.changes> = new Map();

    for (const change of data.changes) {
      const date = new Date(change.detectedAt + 'Z');
      const dateKey = date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
      groups.get(dateKey)!.push(change);
    }

    return groups;
  });
</script>

<div class="container mx-auto px-4 py-6 max-w-4xl">
  <div class="mb-6">
    <h1 class="text-2xl font-bold flex items-center gap-2">
      <History class="w-6 h-6" />
      Recent Changes
    </h1>
    <p class="text-muted-foreground text-sm">
      Track updates to TV shows from the latest sync
      {#if data.pagination.totalCount > 0}
        <span class="ml-1">({data.pagination.totalCount} total changes)</span>
      {/if}
    </p>
  </div>

  {#if data.changes.length === 0}
    <Card.Root>
      <Card.Content class="flex flex-col items-center justify-center py-12 text-center">
        <History class="w-12 h-12 text-muted-foreground mb-4" />
        <h3 class="text-lg font-medium mb-2">No changes yet</h3>
        <p class="text-muted-foreground text-sm max-w-md">
          Changes will appear here after the next sync runs. The sync compares TV show data and logs
          any updates.
        </p>
      </Card.Content>
    </Card.Root>
  {:else}
    <div class="space-y-8">
      {#each groupedChanges as [dateLabel, changes] (dateLabel)}
        <div>
          <h2
            class="text-sm font-medium text-muted-foreground mb-3 sticky top-0 bg-background py-2"
          >
            {dateLabel}
          </h2>
          <div class="space-y-3">
            {#each changes as change (change.id)}
              {@const ChangeIcon = getChangeIcon(change.changeType)}
              <a href="/shows/{change.showId}" class="block">
                <Card.Root class="transition-all hover:ring-2 hover:ring-primary/50">
                  <Card.Content class="p-4">
                    <div class="flex gap-4">
                      <!-- Show Image -->
                      <div class="w-16 h-24 rounded overflow-hidden bg-muted shrink-0">
                        {#if change.showImage}
                          <img
                            src={change.showImage}
                            alt={change.showName}
                            class="w-full h-full object-cover"
                            loading="lazy"
                          />
                        {:else}
                          <div
                            class="w-full h-full flex items-center justify-center text-muted-foreground"
                          >
                            <Tv class="w-6 h-6" />
                          </div>
                        {/if}
                      </div>

                      <!-- Change Details -->
                      <div class="flex-1 min-w-0">
                        <div class="flex items-start justify-between gap-2 mb-1">
                          <h3 class="font-medium truncate">{change.showName}</h3>
                          <Badge
                            variant={getChangeBadgeVariant(change.changeType)}
                            class="shrink-0"
                          >
                            <ChangeIcon class="w-3 h-3 mr-1" />
                            {getChangeLabel(change.changeType)}
                          </Badge>
                        </div>

                        <p class="text-sm text-muted-foreground mb-2">
                          {getChangeDescription(change)}
                        </p>

                        <div class="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock class="w-3 h-3" />
                          {formatDate(change.detectedAt)}
                        </div>
                      </div>
                    </div>
                  </Card.Content>
                </Card.Root>
              </a>
            {/each}
          </div>
        </div>
      {/each}
    </div>

    <!-- Pagination -->
    {#if data.pagination.totalPages > 1}
      <div class="flex items-center justify-center gap-2 mt-8">
        <Button
          variant="outline"
          size="sm"
          href="/changes?page={data.pagination.page - 1}"
          disabled={!data.pagination.hasPrev}
        >
          <ChevronLeft class="w-4 h-4 mr-1" />
          Previous
        </Button>
        <span class="text-sm text-muted-foreground px-4">
          Page {data.pagination.page} of {data.pagination.totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          href="/changes?page={data.pagination.page + 1}"
          disabled={!data.pagination.hasNext}
        >
          Next
          <ChevronRight class="w-4 h-4 ml-1" />
        </Button>
      </div>
    {/if}
  {/if}
</div>
