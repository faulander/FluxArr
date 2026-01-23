<script lang="ts">
  import { User } from '@lucide/svelte';
  import * as Card from '$lib/components/ui/card';
  import { Label } from '$lib/components/ui/label';

  interface Props {
    user: {
      name: string;
      email: string;
      role: string;
    };
  }

  let { user }: Props = $props();
</script>

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
        <p class="font-medium">{user.name}</p>
      </div>
      <div class="space-y-1">
        <Label class="text-muted-foreground text-xs">Email</Label>
        <p class="font-medium">{user.email}</p>
      </div>
      <div class="space-y-1">
        <Label class="text-muted-foreground text-xs">Role</Label>
        <p class="font-medium capitalize">{user.role}</p>
      </div>
    </div>
  </Card.Content>
</Card.Root>
