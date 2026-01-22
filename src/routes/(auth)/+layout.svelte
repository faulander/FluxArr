<script lang="ts">
  import { Tv } from '@lucide/svelte';
  import ThemeToggle from '$lib/components/theme-toggle.svelte';

  let { children }: { children: import('svelte').Snippet } = $props();
</script>

<div class="min-h-screen flex flex-col bg-background">
  <!-- Header -->
  <header class="flex items-center justify-between p-4">
    <a href="/" class="flex items-center gap-2 font-bold text-lg">
      <Tv class="h-6 w-6 text-primary" />
      <span>FluxArr</span>
    </a>
    <ThemeToggle />
  </header>

  <!-- Content -->
  <main class="flex-1 flex items-center justify-center p-4">
    {@render children()}
  </main>

  <!-- Footer -->
  <footer class="p-4 text-center text-sm text-muted-foreground">
    Discover and manage your TV shows
  </footer>
</div>
