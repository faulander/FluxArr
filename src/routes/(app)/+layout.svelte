<script lang="ts">
  import { onMount } from 'svelte';
  import AppShell from '$lib/components/app-shell.svelte';
  import type { LayoutData } from './$types';

  let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

  function applyUserColors() {
    if (!data.userSettings) return;

    const { primaryColorLight, primaryColorDark } = data.userSettings;

    // Store colors for reference
    document.documentElement.style.setProperty('--primary-light-custom', primaryColorLight);
    document.documentElement.style.setProperty('--primary-dark-custom', primaryColorDark);

    // Apply to current theme using a style element for highest specificity
    const isDark = document.documentElement.classList.contains('dark');
    const color = isDark ? primaryColorDark : primaryColorLight;

    // Create or update style element - use hex color directly, browser handles conversion
    let styleEl = document.getElementById('custom-primary-color');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'custom-primary-color';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = `:root, .dark { --primary: ${color} !important; }`;
  }

  onMount(() => {
    applyUserColors();

    // Watch for theme changes
    const observer = new MutationObserver(() => {
      applyUserColors();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  });

  // Re-apply when settings change (e.g., after navigation)
  $effect(() => {
    data.userSettings;
    if (typeof document !== 'undefined') {
      applyUserColors();
    }
  });
</script>

<AppShell user={data.user}>
  {@render children()}
</AppShell>
