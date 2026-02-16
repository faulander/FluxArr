<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import {
    Tv,
    Film,
    Filter,
    Settings,
    Users,
    Menu,
    LogOut,
    Moon,
    Sun,
    ListChecks,
    History
  } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import * as Avatar from '$lib/components/ui/avatar';
  import * as Sheet from '$lib/components/ui/sheet';
  import { cn } from '$lib/utils';
  import type { User } from '$lib/types';
  import { VERSION } from '$lib/version';

  interface Props {
    user: User;
    children: import('svelte').Snippet;
  }

  let { user, children }: Props = $props();

  let theme = $state<'light' | 'dark'>('dark');
  let mobileMenuOpen = $state(false);

  // Initialize theme from localStorage
  $effect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme');
      if (stored === 'light' || stored === 'dark') {
        theme = stored;
      } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        theme = 'dark';
      }
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
  });

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    goto('/login');
  }

  const navItems = [
    { href: '/shows', label: 'Shows', icon: Tv },
    { href: '/movies', label: 'Movies', icon: Film },
    { href: '/requests', label: 'Requests', icon: ListChecks },
    { href: '/changes', label: 'Changes', icon: History },
    { href: '/filters', label: 'Filters', icon: Filter },
    { href: '/settings', label: 'Settings', icon: Settings }
  ];

  const adminItems = [{ href: '/admin', label: 'Users', icon: Users }];

  function isActive(href: string): boolean {
    return $page.url.pathname === href || $page.url.pathname.startsWith(href + '/');
  }
</script>

<div class="flex min-h-screen flex-col bg-background">
  <!-- Header -->
  <header
    class="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
  >
    <div class="flex h-14 items-center px-4 gap-4">
      <!-- Mobile menu button -->
      <Sheet.Root bind:open={mobileMenuOpen}>
        <Sheet.Trigger>
          {#snippet child({ props })}
            <Button {...props} variant="ghost" size="icon" class="md:hidden">
              <Menu class="h-5 w-5" />
              <span class="sr-only">Toggle menu</span>
            </Button>
          {/snippet}
        </Sheet.Trigger>
        <Sheet.Content side="left" class="w-64 p-0">
          <Sheet.Header class="border-b p-4">
            <Sheet.Title class="flex items-center gap-2">
              <Tv class="h-5 w-5 text-primary" />
              <span class="font-bold">FluxArr</span>
            </Sheet.Title>
          </Sheet.Header>
          <nav class="flex flex-col gap-1 p-2">
            {#each navItems as item}
              <a
                href={item.href}
                onclick={() => (mobileMenuOpen = false)}
                class={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive(item.href) ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                )}
              >
                <item.icon class="h-4 w-4" />
                {item.label}
              </a>
            {/each}
            {#if user.role === 'admin'}
              <div class="my-2 border-t"></div>
              {#each adminItems as item}
                <a
                  href={item.href}
                  onclick={() => (mobileMenuOpen = false)}
                  class={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive(item.href) ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                  )}
                >
                  <item.icon class="h-4 w-4" />
                  {item.label}
                </a>
              {/each}
            {/if}
          </nav>
        </Sheet.Content>
      </Sheet.Root>

      <!-- Logo -->
      <a href="/shows" class="flex items-center gap-2 font-bold">
        <Tv class="h-5 w-5 text-primary" />
        <span class="hidden sm:inline">FluxArr</span>
      </a>

      <!-- Desktop nav -->
      <nav class="hidden md:flex items-center gap-1 ml-6">
        {#each navItems as item}
          <a
            href={item.href}
            class={cn(
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive(item.href)
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <item.icon class="h-4 w-4" />
            {item.label}
          </a>
        {/each}
        {#if user.role === 'admin'}
          {#each adminItems as item}
            <a
              href={item.href}
              class={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive(item.href)
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <item.icon class="h-4 w-4" />
              {item.label}
            </a>
          {/each}
        {/if}
      </nav>

      <!-- Spacer -->
      <div class="flex-1"></div>

      <!-- Theme toggle -->
      <Button variant="ghost" size="icon" onclick={toggleTheme}>
        {#if theme === 'dark'}
          <Sun class="h-5 w-5" />
        {:else}
          <Moon class="h-5 w-5" />
        {/if}
        <span class="sr-only">Toggle theme</span>
      </Button>

      <!-- User menu -->
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          {#snippet child({ props })}
            <Button {...props} variant="ghost" class="relative h-8 w-8 rounded-full">
              <Avatar.Root class="h-8 w-8">
                <Avatar.Fallback class="bg-primary text-primary-foreground text-xs">
                  {user.name.slice(0, 2).toUpperCase()}
                </Avatar.Fallback>
              </Avatar.Root>
            </Button>
          {/snippet}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content class="w-56" align="end">
          <DropdownMenu.Label class="font-normal">
            <div class="flex flex-col space-y-1">
              <p class="text-sm font-medium leading-none">{user.name}</p>
              <p class="text-xs leading-none text-muted-foreground">{user.email}</p>
            </div>
          </DropdownMenu.Label>
          <DropdownMenu.Separator />
          <a href="/settings" class="w-full">
            <DropdownMenu.Item>
              <Settings class="mr-2 h-4 w-4" />
              Settings
            </DropdownMenu.Item>
          </a>
          <DropdownMenu.Separator />
          <DropdownMenu.Item onclick={logout} class="text-destructive focus:text-destructive">
            <LogOut class="mr-2 h-4 w-4" />
            Log out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>
  </header>

  <!-- Main content -->
  <main class="flex-1">
    {@render children()}
  </main>

  <!-- Footer -->
  <footer class="border-t py-4 px-4">
    <div class="flex items-center justify-between text-xs text-muted-foreground">
      <div class="flex items-center gap-1">
        <Tv class="h-3 w-3" />
        <span>FluxArr</span>
      </div>
      <span>v{VERSION}</span>
    </div>
  </footer>
</div>
