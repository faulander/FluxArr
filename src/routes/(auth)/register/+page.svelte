<script lang="ts">
  import { goto } from '$app/navigation';
  import { toast } from 'svelte-sonner';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import * as Card from '$lib/components/ui/card';
  import { Loader2 } from '@lucide/svelte';

  let name = $state('');
  let email = $state('');
  let password = $state('');
  let confirmPassword = $state('');
  let loading = $state(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    loading = true;

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Registration failed');
        return;
      }

      if (data.isFirstUser) {
        toast.success('Welcome! You are the admin.');
      } else {
        toast.success('Account created successfully!');
      }

      goto('/shows');
    } catch (error) {
      toast.error('An error occurred. Please try again.');
    } finally {
      loading = false;
    }
  }
</script>

<Card.Root class="w-full max-w-md">
  <Card.Header class="space-y-1">
    <Card.Title class="text-2xl font-bold">Create an account</Card.Title>
    <Card.Description>Enter your details to get started</Card.Description>
  </Card.Header>
  <Card.Content>
    <form onsubmit={handleSubmit} class="space-y-4">
      <div class="space-y-2">
        <Label for="name">Name</Label>
        <Input
          id="name"
          type="text"
          placeholder="John Doe"
          bind:value={name}
          required
          disabled={loading}
        />
      </div>
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
          placeholder="Min. 8 characters"
          bind:value={password}
          required
          minlength={8}
          disabled={loading}
        />
      </div>
      <div class="space-y-2">
        <Label for="confirmPassword">Confirm Password</Label>
        <Input
          id="confirmPassword"
          type="password"
          placeholder="Confirm your password"
          bind:value={confirmPassword}
          required
          disabled={loading}
        />
      </div>
      <Button type="submit" class="w-full" disabled={loading}>
        {#if loading}
          <Loader2 class="mr-2 h-4 w-4 animate-spin" />
          Creating account...
        {:else}
          Create account
        {/if}
      </Button>
    </form>
  </Card.Content>
  <Card.Footer class="flex justify-center">
    <p class="text-sm text-muted-foreground">
      Already have an account?
      <a href="/login" class="font-medium text-primary hover:underline">Sign in</a>
    </p>
  </Card.Footer>
</Card.Root>
