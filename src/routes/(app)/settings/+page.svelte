<script lang="ts">
  import { toast } from 'svelte-sonner';
  import {
    Settings,
    User,
    Server,
    Plus,
    Trash2,
    Check,
    X,
    Loader2,
    Star,
    Users
  } from '@lucide/svelte';
  import * as Card from '$lib/components/ui/card';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Badge } from '$lib/components/ui/badge';
  import { Separator } from '$lib/components/ui/separator';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // Sonarr config state
  let sonarrConfigs = $state(data.sonarrConfigs);
  let addDialogOpen = $state(false);
  let newConfig = $state({ name: '', url: '', apiKey: '', isDefault: false, shared: false });
  let isTesting = $state(false);
  let testResult = $state<{ success: boolean; version?: string; error?: string } | null>(null);
  let isSaving = $state(false);
  let deletingId = $state<number | null>(null);

  async function testConnection() {
    if (!newConfig.url || !newConfig.apiKey) {
      toast.error('Please enter URL and API key');
      return;
    }

    isTesting = true;
    testResult = null;

    try {
      const response = await fetch('/api/sonarr/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newConfig.url, apiKey: newConfig.apiKey })
      });

      testResult = await response.json();

      if (testResult?.success) {
        toast.success(`Connected to Sonarr v${testResult.version}`);
      } else {
        toast.error(testResult?.error || 'Connection failed');
      }
    } catch (error) {
      testResult = { success: false, error: 'Failed to test connection' };
      toast.error('Failed to test connection');
    } finally {
      isTesting = false;
    }
  }

  async function saveConfig() {
    if (!newConfig.name || !newConfig.url || !newConfig.apiKey) {
      toast.error('Please fill in all fields');
      return;
    }

    isSaving = true;

    try {
      const response = await fetch('/api/sonarr/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig)
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'Failed to save configuration');
        return;
      }

      sonarrConfigs = [
        ...sonarrConfigs.map((c) => (newConfig.isDefault ? { ...c, is_default: 0 } : c)),
        { ...result.config, isShared: newConfig.shared }
      ];

      toast.success('Sonarr configuration saved');
      addDialogOpen = false;
      newConfig = { name: '', url: '', apiKey: '', isDefault: false, shared: false };
      testResult = null;
    } catch (error) {
      toast.error('Failed to save configuration');
    } finally {
      isSaving = false;
    }
  }

  async function deleteConfig(id: number) {
    deletingId = id;

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
    } catch (error) {
      toast.error('Failed to delete configuration');
    } finally {
      deletingId = null;
    }
  }

  async function setDefault(id: number) {
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
    } catch (error) {
      toast.error('Failed to set default');
    }
  }
</script>

<div class="container mx-auto px-4 py-6 max-w-2xl space-y-6">
  <div>
    <h1 class="text-2xl font-bold">Settings</h1>
    <p class="text-muted-foreground text-sm">Manage your account and connections</p>
  </div>

  <!-- Profile Section -->
  <Card.Root>
    <Card.Header>
      <Card.Title class="flex items-center gap-2">
        <User class="w-5 h-5" />
        Profile
      </Card.Title>
      <Card.Description>Your account information</Card.Description>
    </Card.Header>
    <Card.Content class="space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-1">
          <Label class="text-muted-foreground text-xs">Name</Label>
          <p class="font-medium">{data.user.name}</p>
        </div>
        <div class="space-y-1">
          <Label class="text-muted-foreground text-xs">Email</Label>
          <p class="font-medium">{data.user.email}</p>
        </div>
        <div class="space-y-1">
          <Label class="text-muted-foreground text-xs">Role</Label>
          <p class="font-medium capitalize">{data.user.role}</p>
        </div>
      </div>
    </Card.Content>
  </Card.Root>

  <!-- Sonarr Section -->
  <Card.Root>
    <Card.Header>
      <div class="flex items-center justify-between">
        <div>
          <Card.Title class="flex items-center gap-2">
            <Server class="w-5 h-5" />
            Sonarr Connections
          </Card.Title>
          <Card.Description>Manage your Sonarr instances</Card.Description>
        </div>
        <Dialog.Root bind:open={addDialogOpen}>
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
                <Label for="name">Name</Label>
                <Input id="name" placeholder="My Sonarr" bind:value={newConfig.name} />
              </div>

              <div class="space-y-2">
                <Label for="url">URL</Label>
                <Input id="url" placeholder="http://localhost:8989" bind:value={newConfig.url} />
              </div>

              <div class="space-y-2">
                <Label for="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="Your Sonarr API key"
                  bind:value={newConfig.apiKey}
                />
                <p class="text-xs text-muted-foreground">
                  Find this in Sonarr under Settings → General → Security
                </p>
              </div>

              <div class="flex items-center gap-4">
                <label class="flex items-center gap-2 text-sm">
                  <input type="checkbox" bind:checked={newConfig.isDefault} class="rounded" />
                  Set as default
                </label>

                {#if data.user.role === 'admin'}
                  <label class="flex items-center gap-2 text-sm">
                    <input type="checkbox" bind:checked={newConfig.shared} class="rounded" />
                    Shared (all users)
                  </label>
                {/if}
              </div>

              {#if testResult}
                <div
                  class="flex items-center gap-2 p-3 rounded-md text-sm {testResult.success
                    ? 'bg-green-500/10 text-green-600'
                    : 'bg-red-500/10 text-red-600'}"
                >
                  {#if testResult.success}
                    <Check class="w-4 h-4" />
                    Connected to Sonarr v{testResult.version}
                  {:else}
                    <X class="w-4 h-4" />
                    {testResult.error}
                  {/if}
                </div>
              {/if}
            </div>

            <Dialog.Footer class="gap-2">
              <Button variant="outline" onclick={testConnection} disabled={isTesting}>
                {#if isTesting}
                  <Loader2 class="w-4 h-4 mr-2 animate-spin" />
                {/if}
                Test Connection
              </Button>
              <Button onclick={saveConfig} disabled={isSaving || !testResult?.success}>
                {#if isSaving}
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
          {#each sonarrConfigs as config}
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
                  <Button variant="ghost" size="sm" onclick={() => setDefault(config.id)}>
                    Set Default
                  </Button>
                {/if}
                <Button
                  variant="ghost"
                  size="icon"
                  class="text-destructive hover:text-destructive"
                  onclick={() => deleteConfig(config.id)}
                  disabled={deletingId === config.id}
                >
                  {#if deletingId === config.id}
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
</div>
