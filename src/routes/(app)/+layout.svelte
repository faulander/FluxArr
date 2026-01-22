<script lang="ts">
  import AppShell from '$lib/components/app-shell.svelte';
  import type { LayoutData } from './$types';

  let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();
</script>

<AppShell user={data.user}>
  {@render children()}
</AppShell>
