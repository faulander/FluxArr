<script lang="ts">
  import { onMount } from 'svelte';
  import { invalidateAll } from '$app/navigation';
  import { toast } from 'svelte-sonner';
  import { Palette, Sun, Moon, RotateCcw, Loader2 } from '@lucide/svelte';
  import * as Card from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Label } from '$lib/components/ui/label';
  import ThemeToggle from '$lib/components/theme-toggle.svelte';

  interface Props {
    initialLightColor?: string;
    initialDarkColor?: string;
  }

  let { initialLightColor = '#000000', initialDarkColor = '#ffffff' }: Props = $props();

  let lightColor = $state(initialLightColor);
  let darkColor = $state(initialDarkColor);
  let isSaving = $state(false);
  let isDarkMode = $state(false);
  let hasChanges = $derived(lightColor !== initialLightColor || darkColor !== initialDarkColor);
  let previewColor = $derived(isDarkMode ? darkColor : lightColor);

  // Preset colors
  const presetColors = [
    { name: 'Blue', light: '#2563eb', dark: '#3b82f6' },
    { name: 'Green', light: '#16a34a', dark: '#22c55e' },
    { name: 'Purple', light: '#7c3aed', dark: '#8b5cf6' },
    { name: 'Orange', light: '#ea580c', dark: '#f97316' },
    { name: 'Pink', light: '#db2777', dark: '#ec4899' },
    { name: 'Teal', light: '#0d9488', dark: '#14b8a6' },
    { name: 'Red', light: '#dc2626', dark: '#ef4444' },
    { name: 'Default', light: '#000000', dark: '#ffffff' }
  ];

  function applyColors() {
    // Store custom colors for reference
    document.documentElement.style.setProperty('--primary-light-custom', lightColor);
    document.documentElement.style.setProperty('--primary-dark-custom', darkColor);

    // Apply to current theme using a style element for highest specificity
    const isDark = document.documentElement.classList.contains('dark');
    const color = isDark ? darkColor : lightColor;

    // Create or update style element - use hex color directly, browser handles conversion
    let styleEl = document.getElementById('custom-primary-color');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'custom-primary-color';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = `:root, .dark { --primary: ${color} !important; }`;
  }

  async function saveColors() {
    isSaving = true;
    try {
      const response = await fetch('/api/settings/appearance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryColorLight: lightColor,
          primaryColorDark: darkColor
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }

      // Update initial values to reflect saved state
      initialLightColor = lightColor;
      initialDarkColor = darkColor;

      // Invalidate all load functions so layout gets updated colors
      await invalidateAll();

      toast.success('Appearance settings saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      isSaving = false;
    }
  }

  function applyPreset(preset: (typeof presetColors)[0]) {
    lightColor = preset.light;
    darkColor = preset.dark;
    applyColors();
  }

  function resetToDefault() {
    lightColor = '#000000';
    darkColor = '#ffffff';
    applyColors();
  }

  function updateDarkMode() {
    isDarkMode = document.documentElement.classList.contains('dark');
  }

  // Apply colors on mount and when they change
  onMount(() => {
    updateDarkMode();
    applyColors();
  });

  $effect(() => {
    // Re-apply colors when they change
    lightColor;
    darkColor;
    applyColors();
  });

  // Listen for theme changes
  $effect(() => {
    const observer = new MutationObserver(() => {
      updateDarkMode();
      applyColors();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  });
</script>

<Card.Root>
  <Card.Header>
    <Card.Title class="flex items-center gap-2">
      <Palette class="w-5 h-5" />
      Appearance
    </Card.Title>
    <Card.Description>Customize the look and feel of the application</Card.Description>
  </Card.Header>
  <Card.Content class="space-y-6">
    <!-- Theme Toggle -->
    <div class="flex items-center justify-between">
      <div class="space-y-0.5">
        <Label>Theme</Label>
        <p class="text-sm text-muted-foreground">Switch between light and dark mode</p>
      </div>
      <ThemeToggle />
    </div>

    <div class="border-t pt-6">
      <Label class="text-base font-medium">Highlight Color</Label>
      <p class="text-sm text-muted-foreground mb-4">
        Choose a highlight color for buttons, links, and interactive elements
      </p>

      <!-- Color Pickers -->
      <div class="grid grid-cols-2 gap-6">
        <!-- Light Mode Color -->
        <div class="space-y-2">
          <Label class="flex items-center gap-2 text-sm">
            <Sun class="w-4 h-4" />
            Light Mode
          </Label>
          <div class="flex items-center gap-3">
            <div class="relative">
              <input
                type="color"
                bind:value={lightColor}
                class="w-12 h-12 rounded-lg cursor-pointer border-2 border-border"
                style="background-color: {lightColor}"
              />
            </div>
            <input
              type="text"
              bind:value={lightColor}
              class="flex h-9 w-28 rounded-md border border-input bg-transparent px-3 py-1 text-sm font-mono uppercase"
              pattern="^#[0-9A-Fa-f]{6}$"
            />
          </div>
        </div>

        <!-- Dark Mode Color -->
        <div class="space-y-2">
          <Label class="flex items-center gap-2 text-sm">
            <Moon class="w-4 h-4" />
            Dark Mode
          </Label>
          <div class="flex items-center gap-3">
            <div class="relative">
              <input
                type="color"
                bind:value={darkColor}
                class="w-12 h-12 rounded-lg cursor-pointer border-2 border-border"
                style="background-color: {darkColor}"
              />
            </div>
            <input
              type="text"
              bind:value={darkColor}
              class="flex h-9 w-28 rounded-md border border-input bg-transparent px-3 py-1 text-sm font-mono uppercase"
              pattern="^#[0-9A-Fa-f]{6}$"
            />
          </div>
        </div>
      </div>

      <!-- Presets -->
      <div class="mt-6">
        <Label class="text-sm text-muted-foreground mb-3 block">Quick Presets</Label>
        <div class="flex flex-wrap gap-2">
          {#each presetColors as preset (preset.name)}
            <button
              type="button"
              onclick={() => applyPreset(preset)}
              class="group relative flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border hover:border-foreground/50 transition-colors"
              title={preset.name}
            >
              <span
                class="w-3 h-3 rounded-full border border-black/10"
                style="background-color: {preset.light}"
              ></span>
              <span
                class="w-3 h-3 rounded-full border border-white/10"
                style="background-color: {preset.dark}"
              ></span>
              <span class="text-xs">{preset.name}</span>
            </button>
          {/each}
        </div>
      </div>

      <!-- Preview -->
      <div class="mt-6 p-4 rounded-lg border border-border bg-muted/30">
        <Label class="text-sm text-muted-foreground mb-3 block">Preview</Label>
        <div class="flex flex-wrap items-center gap-3">
          <button
            class="inline-flex items-center justify-center h-8 px-3 text-sm font-medium rounded-md text-white transition-colors"
            style="background-color: {previewColor}"
          >
            Primary Button
          </button>
          <button
            class="inline-flex items-center justify-center h-8 px-3 text-sm font-medium rounded-md border transition-colors"
            style="border-color: {previewColor}; color: {previewColor}"
          >
            Outline Button
          </button>
          <span class="font-medium" style="color: {previewColor}">Link Text</span>
          <div class="h-6 w-6 rounded-full" style="background-color: {previewColor}"></div>
        </div>
      </div>
    </div>
  </Card.Content>
  <Card.Footer class="flex justify-between">
    <Button variant="outline" size="sm" onclick={resetToDefault}>
      <RotateCcw class="w-4 h-4 mr-2" />
      Reset to Default
    </Button>
    <Button size="sm" onclick={saveColors} disabled={!hasChanges || isSaving}>
      {#if isSaving}
        <Loader2 class="w-4 h-4 mr-2 animate-spin" />
      {/if}
      Save Changes
    </Button>
  </Card.Footer>
</Card.Root>
