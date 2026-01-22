<script lang="ts">
  import { Settings, User, Server } from '@lucide/svelte';
  import * as Card from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Separator } from '$lib/components/ui/separator';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<div class="container mx-auto px-4 py-6 max-w-2xl space-y-6">
  <div>
    <h1 class="text-2xl font-bold">Settings</h1>
    <p class="text-muted-foreground text-sm">Manage your account and preferences</p>
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
      <div class="space-y-2">
        <Label>Name</Label>
        <Input value={data.user.name} disabled />
      </div>
      <div class="space-y-2">
        <Label>Email</Label>
        <Input value={data.user.email} disabled />
      </div>
      <div class="space-y-2">
        <Label>Role</Label>
        <Input value={data.user.role} disabled class="capitalize" />
      </div>
    </Card.Content>
  </Card.Root>

  <!-- Sonarr Section -->
  <Card.Root>
    <Card.Header>
      <Card.Title class="flex items-center gap-2">
        <Server class="w-5 h-5" />
        Sonarr Connection
      </Card.Title>
      <Card.Description>Configure your Sonarr instance to send shows</Card.Description>
    </Card.Header>
    <Card.Content class="space-y-4">
      <div class="space-y-2">
        <Label for="sonarr-url">Sonarr URL</Label>
        <Input id="sonarr-url" placeholder="http://localhost:8989" />
      </div>
      <div class="space-y-2">
        <Label for="sonarr-key">API Key</Label>
        <Input id="sonarr-key" type="password" placeholder="Your Sonarr API key" />
      </div>
      <Button>Save & Test Connection</Button>
      <p class="text-xs text-muted-foreground">
        Sonarr integration coming soon. You'll be able to send discovered shows directly to your Sonarr instance.
      </p>
    </Card.Content>
  </Card.Root>
</div>
