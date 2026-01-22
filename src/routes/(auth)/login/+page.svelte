<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { toast } from 'svelte-sonner';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import * as Card from '$lib/components/ui/card';
  import { Loader2 } from '@lucide/svelte';

  let email = $state('');
  let password = $state('');
  let loading = $state(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    loading = true;

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Login failed');
        return;
      }

      toast.success('Welcome back!');
      const redirectTo = $page.url.searchParams.get('redirect') || '/shows';
      goto(redirectTo);
    } catch (error) {
      toast.error('An error occurred. Please try again.');
    } finally {
      loading = false;
    }
  }
</script>

<Card.Root class="w-full max-w-md">
  <Card.Header class="space-y-1">
    <Card.Title class="text-2xl font-bold">Sign in</Card.Title>
    <Card.Description>Enter your credentials to access your account</Card.Description>
  </Card.Header>
  <Card.Content>
    <form onsubmit={handleSubmit} class="space-y-4">
      <div class="space-y-2">
        <Label for="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          bind:value={email}
          required
          disabled={loading}
        />
      </div>
      <div class="space-y-2">
        <Label for="password">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="********"
          bind:value={password}
          required
          disabled={loading}
        />
      </div>
      <Button type="submit" class="w-full" disabled={loading}>
        {#if loading}
          <Loader2 class="mr-2 h-4 w-4 animate-spin" />
          Signing in...
        {:else}
          Sign in
        {/if}
      </Button>
    </form>
  </Card.Content>
  <Card.Footer class="flex justify-center">
    <p class="text-sm text-muted-foreground">
      Don't have an account?
      <a href="/register" class="font-medium text-primary hover:underline">Sign up</a>
    </p>
  </Card.Footer>
</Card.Root>
