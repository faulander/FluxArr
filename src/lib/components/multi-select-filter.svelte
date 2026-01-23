<script lang="ts">
  import { Plus, Minus } from '@lucide/svelte';
  import { Label } from '$lib/components/ui/label';
  import { cn } from '$lib/utils';

  interface Props {
    label: string;
    allOptions: string[];
    included: string[];
    excluded: string[];
    onIncludeChange: (items: string[]) => void;
    onExcludeChange: (items: string[]) => void;
  }

  let { label, allOptions, included, excluded, onIncludeChange, onExcludeChange }: Props = $props();

  function handleIncludeClick(option: string) {
    const isIncluded = included.includes(option);
    const isExcluded = excluded.includes(option);

    if (isIncluded) {
      onIncludeChange(included.filter((i) => i !== option));
    } else {
      // Remove from exclude if adding to include
      if (isExcluded) {
        onExcludeChange(excluded.filter((i) => i !== option));
      }
      onIncludeChange([...included, option]);
    }
  }

  function handleExcludeClick(option: string) {
    const isIncluded = included.includes(option);
    const isExcluded = excluded.includes(option);

    if (isExcluded) {
      onExcludeChange(excluded.filter((i) => i !== option));
    } else {
      // Remove from include if adding to exclude
      if (isIncluded) {
        onIncludeChange(included.filter((i) => i !== option));
      }
      onExcludeChange([...excluded, option]);
    }
  }
</script>

<div class="space-y-3">
  <Label class="text-sm font-medium">{label}</Label>

  <div class="space-y-2">
    <!-- Include section -->
    <div class="flex items-center gap-2 text-xs text-muted-foreground">
      <Plus class="w-3 h-3 text-green-500" />
      <span>Include (show matching)</span>
    </div>
    <div class="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
      {#each allOptions.slice(0, 50) as option (option)}
        {@const isIncluded = included.includes(option)}
        <button
          type="button"
          onclick={() => handleIncludeClick(option)}
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
      {#each allOptions.slice(0, 50) as option (option)}
        {@const isExcluded = excluded.includes(option)}
        <button
          type="button"
          onclick={() => handleExcludeClick(option)}
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
