<script lang="ts">
  import { Filter, Plus, Trash2, Star } from '@lucide/svelte';
  import * as Card from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
</script>

<div class="container mx-auto px-4 py-6 max-w-4xl space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold">Saved Filters</h1>
      <p class="text-muted-foreground text-sm">Create and manage your filter presets</p>
    </div>
    <Button class="gap-2">
      <Plus class="w-4 h-4" />
      New Filter
    </Button>
  </div>

  <Card.Root>
    <Card.Content class="py-12 text-center">
      <Filter class="w-12 h-12 mx-auto text-muted-foreground mb-4" />
      <h3 class="text-lg font-medium">No saved filters yet</h3>
      <p class="text-muted-foreground text-sm mt-1">
        Create filters from the Discover page and save them here for quick access.
      </p>
      <Button variant="outline" class="mt-4" href="/shows">
        Go to Discover
      </Button>
    </Card.Content>
  </Card.Root>
</div>
