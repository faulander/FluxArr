<script lang="ts">
  import { toast } from 'svelte-sonner';
  import { Server, Film, Plus, Trash2, Check, X, Loader2, Star, Users } from '@lucide/svelte';
  import * as Card from '$lib/components/ui/card';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Badge } from '$lib/components/ui/badge';
  import { Separator } from '$lib/components/ui/separator';

  interface SonarrConfig {
    id: number;
    user_id: number | null;
    name: string;
    url: string;
    is_default: number;
    created_at: string;
    isShared: boolean;
  }

  interface OMDBConfig {
    configured: boolean;
    enabled: boolean;
    apiKeyMasked: string | null;
  }

  interface Props {
    sonarrConfigs: SonarrConfig[];
    omdbConfig: OMDBConfig;
    isAdmin: boolean;
  }

  let {
    sonarrConfigs: initialSonarrConfigs,
    omdbConfig: initialOmdbConfig,
    isAdmin
  }: Props = $props();

  // Sonarr state
  let sonarrConfigs = $state<SonarrConfig[]>([...initialSonarrConfigs]);
  let addSonarrDialogOpen = $state(false);
  let newSonarrConfig = $state({ name: '', url: '', apiKey: '', isDefault: false, shared: false });
  let isSonarrTesting = $state(false);
  let sonarrTestResult = $state<{ success: boolean; version?: string; error?: string } | null>(
    null
  );
  let isSonarrSaving = $state(false);
  let deletingSonarrId = $state<number | null>(null);

  // OMDB state
  let omdbConfig = $state<OMDBConfig>({ ...initialOmdbConfig });
  let omdbDialogOpen = $state(false);
  let omdbApiKey = $state('');
  let isOmdbTesting = $state(false);
  let omdbTestResult = $state<{ success: boolean; error?: string } | null>(null);
  let isOmdbSaving = $state(false);

  // Sonarr functions
  async function testSonarrConnection() {
    if (!newSonarrConfig.url || !newSonarrConfig.apiKey) {
      toast.error('Please enter URL and API key');
      return;
    }

    isSonarrTesting = true;
    sonarrTestResult = null;

    try {
      const response = await fetch('/api/sonarr/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newSonarrConfig.url, apiKey: newSonarrConfig.apiKey })
      });

      sonarrTestResult = await response.json();

      if (sonarrTestResult?.success) {
        toast.success(`Connected to Sonarr v${sonarrTestResult.version}`);
      } else {
        toast.error(sonarrTestResult?.error || 'Connection failed');
      }
    } catch {
      sonarrTestResult = { success: false, error: 'Failed to test connection' };
      toast.error('Failed to test connection');
    } finally {
      isSonarrTesting = false;
    }
  }

  async function saveSonarrConfig() {
    if (!newSonarrConfig.name || !newSonarrConfig.url || !newSonarrConfig.apiKey) {
      toast.error('Please fill in all fields');
      return;
    }

    isSonarrSaving = true;

    try {
      const response = await fetch('/api/sonarr/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSonarrConfig)
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'Failed to save configuration');
        return;
      }

      sonarrConfigs = [
        ...sonarrConfigs.map((c) => (newSonarrConfig.isDefault ? { ...c, is_default: 0 } : c)),
        { ...result.config, isShared: newSonarrConfig.shared }
      ];

      toast.success('Sonarr configuration saved');
      addSonarrDialogOpen = false;
      newSonarrConfig = { name: '', url: '', apiKey: '', isDefault: false, shared: false };
      sonarrTestResult = null;
    } catch {
      toast.error('Failed to save configuration');
    } finally {
      isSonarrSaving = false;
    }
  }

  async function deleteSonarrConfig(id: number) {
    deletingSonarrId = id;

    try {
      const response = await fetch(`/api/sonarr/configs?id=${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const result = await response.json();
        toast.error(result.error || 'Failed to delete configuration');
        return;
      }

      sonarrConfigs = sonarrConfigs.filter((c) => c.id !== id);
      toast.success('Configuration deleted');
    } catch {
      toast.error('Failed to delete configuration');
    } finally {
      deletingSonarrId = null;
    }
  }

  async function setSonarrDefault(id: number) {
    try {
      const response = await fetch('/api/sonarr/configs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isDefault: true })
      });

      if (!response.ok) {
        toast.error('Failed to set default');
        return;
      }

      sonarrConfigs = sonarrConfigs.map((c) => ({
        ...c,
        is_default: c.id === id ? 1 : 0
      }));

      toast.success('Default updated');
    } catch {
      toast.error('Failed to set default');
    }
  }

  // OMDB functions
  async function testOmdbConnection() {
    if (!omdbApiKey) {
      toast.error('Please enter an API key');
      return;
    }

    isOmdbTesting = true;
    omdbTestResult = null;

    try {
      const response = await fetch('/api/omdb/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: omdbApiKey })
      });

      omdbTestResult = await response.json();

      if (omdbTestResult?.success) {
        toast.success('OMDB API connection successful');
      } else {
        toast.error(omdbTestResult?.error || 'Connection failed');
      }
    } catch {
      omdbTestResult = { success: false, error: 'Failed to test connection' };
      toast.error('Failed to test connection');
    } finally {
      isOmdbTesting = false;
    }
  }

  async function saveOmdbConfig() {
    if (!omdbApiKey) {
      toast.error('Please enter an API key');
      return;
    }

    isOmdbSaving = true;

    try {
      const response = await fetch('/api/omdb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: omdbApiKey, enabled: true })
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'Failed to save configuration');
        return;
      }

      omdbConfig = {
        configured: true,
        enabled: true,
        apiKeyMasked: `${omdbApiKey.slice(0, 4)}${'*'.repeat(4)}`
      };

      toast.success('OMDB configuration saved. IMDB ratings will be fetched during next sync.');
      omdbDialogOpen = false;
      omdbApiKey = '';
      omdbTestResult = null;
    } catch {
      toast.error('Failed to save configuration');
    } finally {
      isOmdbSaving = false;
    }
  }

  async function disableOmdb() {
    try {
      const response = await fetch('/api/omdb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: '', enabled: false })
      });

      if (!response.ok) {
        toast.error('Failed to disable OMDB');
        return;
      }

      omdbConfig = { configured: false, enabled: false, apiKeyMasked: null };
      toast.success('OMDB disabled');
    } catch {
      toast.error('Failed to disable OMDB');
    }
  }
</script>

<div class="space-y-6">
  <!-- Sonarr Section -->
  <Card.Root>
    <Card.Header>
      <div class="flex items-center justify-between">
        <div>
          <Card.Title class="flex items-center gap-2">
            <Server class="w-5 h-5" />
            Sonarr
          </Card.Title>
          <Card.Description>Connect Sonarr instances to send shows for downloading</Card.Description
          >
        </div>
        <Dialog.Root bind:open={addSonarrDialogOpen}>
          <Dialog.Trigger>
            {#snippet child({ props })}
              <Button {...props} size="sm" class="gap-2">
                <Plus class="w-4 h-4" />
                Add
              </Button>
            {/snippet}
          </Dialog.Trigger>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Add Sonarr Instance</Dialog.Title>
              <Dialog.Description>
                Connect a Sonarr instance to send shows for automatic downloading.
              </Dialog.Description>
            </Dialog.Header>

            <div class="space-y-4 py-4">
              <div class="space-y-2">
                <Label for="sonarr-name">Name</Label>
                <Input id="sonarr-name" placeholder="My Sonarr" bind:value={newSonarrConfig.name} />
              </div>

              <div class="space-y-2">
                <Label for="sonarr-url">URL</Label>
                <Input
                  id="sonarr-url"
                  placeholder="http://localhost:8989"
                  bind:value={newSonarrConfig.url}
                />
              </div>

              <div class="space-y-2">
                <Label for="sonarr-apiKey">API Key</Label>
                <Input
                  id="sonarr-apiKey"
                  type="password"
                  placeholder="Your Sonarr API key"
                  bind:value={newSonarrConfig.apiKey}
                />
                <p class="text-xs text-muted-foreground">
                  Find this in Sonarr under Settings → General → Security
                </p>
              </div>

              <div class="flex items-center gap-4">
                <label class="flex items-center gap-2 text-sm">
                  <input type="checkbox" bind:checked={newSonarrConfig.isDefault} class="rounded" />
                  Set as default
                </label>

                {#if isAdmin}
                  <label class="flex items-center gap-2 text-sm">
                    <input type="checkbox" bind:checked={newSonarrConfig.shared} class="rounded" />
                    Shared (all users)
                  </label>
                {/if}
              </div>

              {#if sonarrTestResult}
                <div
                  class="flex items-center gap-2 p-3 rounded-md text-sm {sonarrTestResult.success
                    ? 'bg-green-500/10 text-green-600'
                    : 'bg-red-500/10 text-red-600'}"
                >
                  {#if sonarrTestResult.success}
                    <Check class="w-4 h-4" />
                    Connected to Sonarr v{sonarrTestResult.version}
                  {:else}
                    <X class="w-4 h-4" />
                    {sonarrTestResult.error}
                  {/if}
                </div>
              {/if}
            </div>

            <Dialog.Footer class="gap-2">
              <Button variant="outline" onclick={testSonarrConnection} disabled={isSonarrTesting}>
                {#if isSonarrTesting}
                  <Loader2 class="w-4 h-4 mr-2 animate-spin" />
                {/if}
                Test Connection
              </Button>
              <Button
                onclick={saveSonarrConfig}
                disabled={isSonarrSaving || !sonarrTestResult?.success}
              >
                {#if isSonarrSaving}
                  <Loader2 class="w-4 h-4 mr-2 animate-spin" />
                {/if}
                Save
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Root>
      </div>
    </Card.Header>
    <Card.Content>
      {#if sonarrConfigs.length === 0}
        <div class="text-center py-6 text-muted-foreground">
          <Server class="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p class="text-sm">No Sonarr instances configured</p>
          <p class="text-xs mt-1">Add one to start sending shows</p>
        </div>
      {:else}
        <div class="space-y-3">
          {#each sonarrConfigs as config (config.id)}
            <div class="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div class="flex items-center gap-3">
                <Server class="w-5 h-5 text-muted-foreground" />
                <div>
                  <div class="flex items-center gap-2">
                    <span class="font-medium">{config.name}</span>
                    {#if config.is_default}
                      <Badge variant="secondary" class="text-xs">
                        <Star class="w-3 h-3 mr-1" />
                        Default
                      </Badge>
                    {/if}
                    {#if config.isShared}
                      <Badge variant="outline" class="text-xs">
                        <Users class="w-3 h-3 mr-1" />
                        Shared
                      </Badge>
                    {/if}
                  </div>
                  <p class="text-sm text-muted-foreground">{config.url}</p>
                </div>
              </div>

              <div class="flex items-center gap-2">
                {#if !config.is_default}
                  <Button variant="ghost" size="sm" onclick={() => setSonarrDefault(config.id)}>
                    Set Default
                  </Button>
                {/if}
                <Button
                  variant="ghost"
                  size="icon"
                  class="text-destructive hover:text-destructive"
                  onclick={() => deleteSonarrConfig(config.id)}
                  disabled={deletingSonarrId === config.id}
                >
                  {#if deletingSonarrId === config.id}
                    <Loader2 class="w-4 h-4 animate-spin" />
                  {:else}
                    <Trash2 class="w-4 h-4" />
                  {/if}
                </Button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </Card.Content>
  </Card.Root>

  <!-- OMDB Section (Admin only) -->
  {#if isAdmin}
    <Card.Root>
      <Card.Header>
        <div class="flex items-center justify-between">
          <div>
            <Card.Title class="flex items-center gap-2">
              <Film class="w-5 h-5" />
              OMDB (IMDB Ratings)
            </Card.Title>
            <Card.Description>Connect to OMDB API to fetch IMDB ratings for shows</Card.Description>
          </div>
          <Dialog.Root bind:open={omdbDialogOpen}>
            <Dialog.Trigger>
              {#snippet child({ props })}
                <Button {...props} size="sm" class="gap-2">
                  {#if omdbConfig.configured}
                    Update
                  {:else}
                    <Plus class="w-4 h-4" />
                    Configure
                  {/if}
                </Button>
              {/snippet}
            </Dialog.Trigger>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Configure OMDB API</Dialog.Title>
                <Dialog.Description>
                  Enter your OMDB API key to fetch IMDB ratings. Get a free key at{' '}
                  <a
                    href="https://www.omdbapi.com/apikey.aspx"
                    target="_blank"
                    class="text-primary underline"
                  >
                    omdbapi.com
                  </a>
                </Dialog.Description>
              </Dialog.Header>

              <div class="space-y-4 py-4">
                <div class="space-y-2">
                  <Label for="omdb-apiKey">API Key</Label>
                  <Input
                    id="omdb-apiKey"
                    type="password"
                    placeholder="Your OMDB API key"
                    bind:value={omdbApiKey}
                  />
                  <p class="text-xs text-muted-foreground">
                    Free tier allows 1,000 requests per day
                  </p>
                </div>

                {#if omdbTestResult}
                  <div
                    class="flex items-center gap-2 p-3 rounded-md text-sm {omdbTestResult.success
                      ? 'bg-green-500/10 text-green-600'
                      : 'bg-red-500/10 text-red-600'}"
                  >
                    {#if omdbTestResult.success}
                      <Check class="w-4 h-4" />
                      API key is valid
                    {:else}
                      <X class="w-4 h-4" />
                      {omdbTestResult.error}
                    {/if}
                  </div>
                {/if}
              </div>

              <Dialog.Footer class="gap-2">
                <Button variant="outline" onclick={testOmdbConnection} disabled={isOmdbTesting}>
                  {#if isOmdbTesting}
                    <Loader2 class="w-4 h-4 mr-2 animate-spin" />
                  {/if}
                  Test Connection
                </Button>
                <Button
                  onclick={saveOmdbConfig}
                  disabled={isOmdbSaving || !omdbTestResult?.success}
                >
                  {#if isOmdbSaving}
                    <Loader2 class="w-4 h-4 mr-2 animate-spin" />
                  {/if}
                  Save
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Root>
        </div>
      </Card.Header>
      <Card.Content>
        {#if !omdbConfig.configured}
          <div class="text-center py-6 text-muted-foreground">
            <Film class="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p class="text-sm">OMDB not configured</p>
            <p class="text-xs mt-1">Add an API key to fetch IMDB ratings</p>
          </div>
        {:else}
          <div class="flex items-center justify-between p-3 rounded-lg border bg-card">
            <div class="flex items-center gap-3">
              <Film class="w-5 h-5 text-muted-foreground" />
              <div>
                <div class="flex items-center gap-2">
                  <span class="font-medium">OMDB API</span>
                  <Badge variant={omdbConfig.enabled ? 'default' : 'secondary'} class="text-xs">
                    {omdbConfig.enabled ? 'Active' : 'Disabled'}
                  </Badge>
                </div>
                <p class="text-sm text-muted-foreground">
                  API Key: {omdbConfig.apiKeyMasked}
                </p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              class="text-destructive hover:text-destructive"
              onclick={disableOmdb}
            >
              <Trash2 class="w-4 h-4" />
            </Button>
          </div>
        {/if}
      </Card.Content>
    </Card.Root>
  {/if}
</div>
