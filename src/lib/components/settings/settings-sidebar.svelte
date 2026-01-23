<script lang="ts">
  import { User, Server, Clock, FileText } from '@lucide/svelte';
  import { cn } from '$lib/utils';

  export type SettingsSection = 'profile' | 'sonarr' | 'jobs' | 'logs';

  interface NavItem {
    id: SettingsSection;
    label: string;
    icon: typeof User;
    adminOnly?: boolean;
  }

  interface Props {
    activeSection: SettingsSection;
    onSectionChange: (section: SettingsSection) => void;
    isAdmin: boolean;
  }

  let { activeSection, onSectionChange, isAdmin }: Props = $props();

  const navItems: NavItem[] = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'sonarr', label: 'Sonarr', icon: Server },
    { id: 'jobs', label: 'Background Jobs', icon: Clock, adminOnly: true },
    { id: 'logs', label: 'Logs', icon: FileText, adminOnly: true }
  ];

  const visibleItems = $derived(navItems.filter((item) => !item.adminOnly || isAdmin));
</script>

<nav class="w-48 shrink-0 space-y-1">
  {#each visibleItems as item (item.id)}
    <button
      onclick={() => onSectionChange(item.id)}
      class={cn(
        'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        activeSection === item.id
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      <item.icon class="h-4 w-4" />
      {item.label}
    </button>
  {/each}
</nav>
