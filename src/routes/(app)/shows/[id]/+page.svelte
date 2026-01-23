<script lang="ts">
  import { goto } from '$app/navigation';
  import { toast } from 'svelte-sonner';
  import {
    ArrowLeft,
    Star,
    Calendar,
    Clock,
    Globe,
    Tv,
    ExternalLink,
    Send,
    Play,
    Info,
    Loader2,
    Check,
    HardDrive
  } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as Select from '$lib/components/ui/select';
  import { Label } from '$lib/components/ui/label';
  import { Separator } from '$lib/components/ui/separator';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const show = data.show;

  // Parse JSON fields
  const genres = $derived(() => {
    try {
      return JSON.parse(show.genres || '[]') as string[];
    } catch {
      return [] as string[];
    }
  });

  const scheduleDays = $derived(() => {
    try {
      return JSON.parse(show.schedule_days || '[]') as string[];
    } catch {
      return [] as string[];
    }
  });

  // Strip HTML from summary
  const cleanSummary = $derived(() => {
    if (!show.summary) return 'No description available.';
    return show.summary.replace(/<[^>]*>/g, '');
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
  const runtime = $derived(show.runtime || show.average_runtime);

  // Format bytes to human readable
  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Sonarr dialog state
  let sonarrDialogOpen = $state(false);
  let selectedConfigId = $state<string>(
    data.sonarrConfigs.find((c) => c.is_default)?.id.toString() || ''
  );
  let selectedQualityProfileId = $state<string>('');
  let selectedRootFolderId = $state<string>('');
  let isSending = $state(false);

  // Get the currently selected config with its options
  const selectedConfig = $derived(() => {
    if (!selectedConfigId) return null;
    return data.sonarrConfigs.find((c) => c.id.toString() === selectedConfigId) || null;
  });

  // Derive selected config name for display
  const selectedConfigName = $derived(() => {
    const config = selectedConfig();
    return config?.name || 'Select instance...';
  });

  // Derive selected quality profile name
  const selectedQualityProfileName = $derived(() => {
    const config = selectedConfig();
    if (!config || !selectedQualityProfileId) return 'Select profile...';
    const profile = config.qualityProfiles.find(
      (p) => p.id.toString() === selectedQualityProfileId
    );
    return profile?.name || 'Select profile...';
  });

  // Derive selected root folder name
  const selectedRootFolderName = $derived(() => {
    const config = selectedConfig();
    if (!config || !selectedRootFolderId) return 'Select folder...';
    const folder = config.rootFolders.find((f) => f.id.toString() === selectedRootFolderId);
    return folder?.path || 'Select folder...';
  });

  // Reset profile and folder selection when config changes
  $effect(() => {
    const config = selectedConfig();
    if (config) {
      // Auto-select first profile and folder if available
      if (config.qualityProfiles.length > 0 && !selectedQualityProfileId) {
        selectedQualityProfileId = config.qualityProfiles[0].id.toString();
      }
      if (config.rootFolders.length > 0 && !selectedRootFolderId) {
        selectedRootFolderId = config.rootFolders[0].id.toString();
      }
    }
  });

  async function sendToSonarr() {
    if (!selectedConfigId) {
      toast.error('Please select a Sonarr instance');
      return;
    }
    if (!selectedQualityProfileId) {
      toast.error('Please select a quality profile');
      return;
    }
    if (!selectedRootFolderId) {
      toast.error('Please select a root folder');
      return;
    }

    const config = selectedConfig();
    if (!config) return;

    const rootFolder = config.rootFolders.find((f) => f.id.toString() === selectedRootFolderId);
    if (!rootFolder) return;

    isSending = true;

    try {
      const response = await fetch('/api/sonarr/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          configId: parseInt(selectedConfigId, 10),
          tvdbId: show.thetvdb_id,
          title: show.name,
          qualityProfileId: parseInt(selectedQualityProfileId, 10),
          rootFolderPath: rootFolder.path
        })
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'Failed to add show to Sonarr');
        return;
      }

      toast.success(`${show.name} added to Sonarr!`);
      sonarrDialogOpen = false;
    } catch (error) {
      toast.error('Failed to connect to Sonarr');
    } finally {
      isSending = false;
    }
  }
</script>

<div class="min-h-screen">
  <!-- Hero section with backdrop -->
  <div class="relative">
    <!-- Gradient overlay -->
    <div
      class="absolute inset-0 bg-gradient-to-b from-background/80 via-background/95 to-background"
    ></div>

    <!-- Content -->
    <div class="relative container mx-auto px-4 py-6">
      <!-- Back button -->
      <Button variant="ghost" size="sm" onclick={() => goto('/shows')} class="mb-6 -ml-2">
        <ArrowLeft class="w-4 h-4 mr-2" />
        Back to Discover
      </Button>

      <div class="flex flex-col md:flex-row gap-8">
        <!-- Poster -->
        <div class="shrink-0 mx-auto md:mx-0">
          <div class="relative w-64 aspect-[2/3] rounded-lg overflow-hidden shadow-xl bg-muted">
            {#if show.image_original || show.image_medium}
              <img
                src={show.image_original || show.image_medium}
                alt={show.name}
                class="w-full h-full object-cover"
              />
            {:else}
              <div class="w-full h-full flex items-center justify-center">
                <Tv class="w-16 h-16 text-muted-foreground" />
              </div>
            {/if}
          </div>
        </div>

        <!-- Info -->
        <div class="flex-1 space-y-4">
          <div>
            <h1 class="text-3xl md:text-4xl font-bold">{show.name}</h1>

            <div class="flex flex-wrap items-center gap-3 mt-3">
              <Badge variant="outline" class={statusColor()}>{show.status}</Badge>

              {#if show.rating_average}
                <div class="flex items-center gap-1 text-sm">
                  <Star class="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span class="font-medium">{show.rating_average.toFixed(1)}</span>
                </div>
              {/if}

              {#if year}
                <div class="flex items-center gap-1 text-sm text-muted-foreground">
                  <Calendar class="w-4 h-4" />
                  {year}{show.ended ? ` - ${new Date(show.ended).getFullYear()}` : ''}
                </div>
              {/if}

              {#if runtime}
                <div class="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock class="w-4 h-4" />
                  {runtime} min
                </div>
              {/if}
            </div>
          </div>

          <!-- Genres -->
          {#if genres().length > 0}
            <div class="flex flex-wrap gap-2">
              {#each genres() as genre}
                <Badge variant="secondary">{genre}</Badge>
              {/each}
            </div>
          {/if}

          <!-- Network / Schedule -->
          <div class="flex flex-wrap items-center gap-4 text-sm">
            <div class="flex items-center gap-2">
              <Globe class="w-4 h-4 text-muted-foreground" />
              <span>{network}</span>
              {#if show.network_country_code || show.web_channel_country_code}
                <span class="text-muted-foreground">
                  ({show.network_country_code || show.web_channel_country_code})
                </span>
              {/if}
            </div>

            {#if scheduleDays().length > 0 && show.schedule_time}
              <div class="flex items-center gap-2">
                <Play class="w-4 h-4 text-muted-foreground" />
                <span>{scheduleDays().join(', ')} at {show.schedule_time}</span>
              </div>
            {/if}

            {#if show.language}
              <div class="flex items-center gap-2">
                <Info class="w-4 h-4 text-muted-foreground" />
                <span>{show.language}</span>
              </div>
            {/if}
          </div>

          <!-- Description -->
          <p class="text-muted-foreground leading-relaxed max-w-3xl">{cleanSummary()}</p>

          <!-- Sonarr Status Banner -->
          {#if data.sonarrEntry}
            <div
              class="flex items-start gap-4 p-4 rounded-lg bg-green-500/10 border border-green-500/20"
            >
              <div class="flex items-center justify-center w-10 h-10 rounded-full bg-green-500/20">
                <Check class="w-5 h-5 text-green-500" />
              </div>
              <div class="flex-1">
                <h4 class="font-medium text-green-600 dark:text-green-400">Already in Sonarr</h4>
                <p class="text-sm text-muted-foreground mt-0.5">
                  Added via "{data.sonarrEntry.config_name}"
                </p>
                <div class="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                  <span class="flex items-center gap-1">
                    <Tv class="w-3 h-3" />
                    {data.sonarrEntry.episode_file_count}/{data.sonarrEntry.episode_count} episodes
                  </span>
                  {#if data.sonarrEntry.size_on_disk > 0}
                    <span class="flex items-center gap-1">
                      <HardDrive class="w-3 h-3" />
                      {formatBytes(data.sonarrEntry.size_on_disk)}
                    </span>
                  {/if}
                  <Badge
                    variant={data.sonarrEntry.monitored ? 'default' : 'secondary'}
                    class="text-xs"
                  >
                    {data.sonarrEntry.monitored ? 'Monitored' : 'Unmonitored'}
                  </Badge>
                </div>
              </div>
            </div>
          {/if}

          <!-- Actions -->
          <div class="flex flex-wrap gap-3 pt-2">
            {#if data.sonarrEntry}
              <!-- Show is already in Sonarr -->
              <Button disabled variant="outline" class="gap-2">
                <Check class="w-4 h-4" />
                In Sonarr
              </Button>
            {:else if show.thetvdb_id && data.sonarrConfigs.length > 0}
              <Dialog.Root bind:open={sonarrDialogOpen}>
                <Dialog.Trigger>
                  {#snippet child({ props })}
                    <Button {...props} class="gap-2">
                      <Send class="w-4 h-4" />
                      Send to Sonarr
                    </Button>
                  {/snippet}
                </Dialog.Trigger>
                <Dialog.Content>
                  <Dialog.Header>
                    <Dialog.Title>Add to Sonarr</Dialog.Title>
                    <Dialog.Description>
                      Add "{show.name}" to your Sonarr instance for automatic downloading.
                    </Dialog.Description>
                  </Dialog.Header>

                  <div class="space-y-4 py-4">
                    <div class="space-y-2">
                      <Label>Sonarr Instance</Label>
                      <Select.Root type="single" bind:value={selectedConfigId}>
                        <Select.Trigger class="w-full">
                          {selectedConfigName()}
                        </Select.Trigger>
                        <Select.Content>
                          {#each data.sonarrConfigs as config}
                            <Select.Item value={config.id.toString()}>
                              {config.name}
                              {#if config.is_default}
                                <Badge variant="secondary" class="ml-2 text-xs">Default</Badge>
                              {/if}
                            </Select.Item>
                          {/each}
                        </Select.Content>
                      </Select.Root>
                    </div>

                    {#if selectedConfig()}
                      <div class="space-y-2">
                        <Label>Quality Profile</Label>
                        <Select.Root type="single" bind:value={selectedQualityProfileId}>
                          <Select.Trigger class="w-full">
                            {selectedQualityProfileName()}
                          </Select.Trigger>
                          <Select.Content>
                            {#each selectedConfig()?.qualityProfiles || [] as profile}
                              <Select.Item value={profile.id.toString()}>
                                {profile.name}
                              </Select.Item>
                            {/each}
                          </Select.Content>
                        </Select.Root>
                      </div>

                      <div class="space-y-2">
                        <Label>Root Folder</Label>
                        <Select.Root type="single" bind:value={selectedRootFolderId}>
                          <Select.Trigger class="w-full">
                            {selectedRootFolderName()}
                          </Select.Trigger>
                          <Select.Content>
                            {#each selectedConfig()?.rootFolders || [] as folder}
                              <Select.Item value={folder.id.toString()}>
                                {folder.path}
                                <span class="ml-2 text-xs text-muted-foreground">
                                  ({formatBytes(folder.freeSpace)} free)
                                </span>
                              </Select.Item>
                            {/each}
                          </Select.Content>
                        </Select.Root>
                      </div>
                    {/if}
                  </div>

                  <Dialog.Footer>
                    <Button variant="outline" onclick={() => (sonarrDialogOpen = false)}>
                      Cancel
                    </Button>
                    <Button
                      onclick={sendToSonarr}
                      disabled={isSending ||
                        !selectedConfigId ||
                        !selectedQualityProfileId ||
                        !selectedRootFolderId}
                    >
                      {#if isSending}
                        <Loader2 class="w-4 h-4 mr-2 animate-spin" />
                        Adding...
                      {:else}
                        Add to Sonarr
                      {/if}
                    </Button>
                  </Dialog.Footer>
                </Dialog.Content>
              </Dialog.Root>
            {:else if show.thetvdb_id}
              <Button disabled variant="outline" class="gap-2">
                <Send class="w-4 h-4" />
                Configure Sonarr in Settings
              </Button>
            {:else}
              <Button disabled variant="outline" class="gap-2">
                <Send class="w-4 h-4" />
                No TVDB ID available
              </Button>
            {/if}

            {#if show.official_site}
              <Button variant="outline" href={show.official_site} target="_blank" class="gap-2">
                <ExternalLink class="w-4 h-4" />
                Official Site
              </Button>
            {/if}

            {#if show.imdb_id}
              <Button
                variant="outline"
                href={`https://www.imdb.com/title/${show.imdb_id}`}
                target="_blank"
                class="gap-2"
              >
                <ExternalLink class="w-4 h-4" />
                IMDb
              </Button>
            {/if}
          </div>
        </div>
      </div>
    </div>
  </div>

  <Separator class="my-6" />

  <!-- Additional Info -->
  <div class="container mx-auto px-4 pb-12">
    <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
      <div>
        <h3 class="text-sm font-medium text-muted-foreground mb-1">Type</h3>
        <p>{show.type || 'Unknown'}</p>
      </div>

      <div>
        <h3 class="text-sm font-medium text-muted-foreground mb-1">Premiered</h3>
        <p>{show.premiered || 'Unknown'}</p>
      </div>

      {#if show.ended}
        <div>
          <h3 class="text-sm font-medium text-muted-foreground mb-1">Ended</h3>
          <p>{show.ended}</p>
        </div>
      {/if}

      <div>
        <h3 class="text-sm font-medium text-muted-foreground mb-1">TVMaze ID</h3>
        <p>{show.id}</p>
      </div>

      {#if show.thetvdb_id}
        <div>
          <h3 class="text-sm font-medium text-muted-foreground mb-1">TheTVDB ID</h3>
          <p>{show.thetvdb_id}</p>
        </div>
      {/if}

      {#if show.imdb_id}
        <div>
          <h3 class="text-sm font-medium text-muted-foreground mb-1">IMDb ID</h3>
          <p>{show.imdb_id}</p>
        </div>
      {/if}
    </div>
  </div>
</div>
