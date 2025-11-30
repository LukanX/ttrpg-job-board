-- Create characters table
create table public.characters (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  class text not null,
  ancestry text not null,
  level integer not null default 1,
  stats jsonb default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint characters_pkey primary key (id)
);

-- Enable RLS
alter table public.characters enable row level security;

-- Create policies
create policy "Users can view their own characters"
  on public.characters for select
  using (auth.uid() = user_id);

create policy "Users can insert their own characters"
  on public.characters for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own characters"
  on public.characters for update
  using (auth.uid() = user_id);

create policy "Users can delete their own characters"
  on public.characters for delete
  using (auth.uid() = user_id);

-- Add character_id to campaign_members
alter table public.campaign_members 
add column character_id uuid references public.characters(id) on delete set null;

-- Allow GMs to view characters in their campaigns
create policy "GMs can view characters in their campaigns"
  on public.characters for select
  using (
    exists (
      select 1 from public.campaign_members cm
      join public.campaigns c on c.id = cm.campaign_id
      where cm.character_id = characters.id
      and c.gm_id = auth.uid()
    )
  );

-- Allow other players in the same campaign to view characters
create policy "Players can view characters in shared campaigns"
  on public.characters for select
  using (
    exists (
      select 1 from public.campaign_members cm_target
      join public.campaign_members cm_viewer on cm_target.campaign_id = cm_viewer.campaign_id
      where cm_target.character_id = characters.id
      and cm_viewer.user_id = auth.uid()
    )
  );