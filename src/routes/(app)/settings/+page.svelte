<script lang="ts">
  import { Settings } from '@lucide/svelte';
  import SettingsSidebar, {
    type SettingsSection
  } from '$lib/components/settings/settings-sidebar.svelte';
  import ProfileSettings from '$lib/components/settings/profile-settings.svelte';
  import AppearanceSettings from '$lib/components/settings/appearance-settings.svelte';
  import ConnectionsSettings from '$lib/components/settings/connections-settings.svelte';
  import JobsSettings from '$lib/components/settings/jobs-settings.svelte';
  import LogsSettings from '$lib/components/settings/logs-settings.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let activeSection = $state<SettingsSection>('profile');
  const isAdmin = $derived(data.user.role === 'admin');

  function handleSectionChange(section: SettingsSection) {
    activeSection = section;
  }
</script>

<div class="container mx-auto px-4 py-6 max-w-4xl">
  <div class="mb-6">
    <h1 class="text-2xl font-bold flex items-center gap-2">
      <Settings class="w-6 h-6" />
      Settings
    </h1>
    <p class="text-muted-foreground text-sm">Manage your account and connections</p>
  </div>

  <div class="flex gap-6">
    <SettingsSidebar {activeSection} onSectionChange={handleSectionChange} {isAdmin} />

    <div class="flex-1 min-w-0">
      {#if activeSection === 'profile'}
        <ProfileSettings user={data.user} />
      {:else if activeSection === 'appearance'}
        <AppearanceSettings
          initialLightColor={data.userSettings?.primaryColorLight}
          initialDarkColor={data.userSettings?.primaryColorDark}
        />
      {:else if activeSection === 'connections'}
        <ConnectionsSettings
          sonarrConfigs={data.sonarrConfigs}
          omdbConfig={data.omdbConfig}
          {isAdmin}
        />
      {:else if activeSection === 'jobs'}
        <JobsSettings />
      {:else if activeSection === 'logs'}
        <LogsSettings />
      {/if}
    </div>
  </div>
</div>
