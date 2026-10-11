-- Lakad database schema for Supabase.
-- Run this once in Supabase: SQL Editor > New query > paste > Run.

-- Public profile (only a display name is shared with other users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 40),
  created_at timestamptz not null default now()
);

-- Private: each user's own activities, daily step entries and settings
create table if not exists public.activities (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  data jsonb not null,
  updated_ms bigint not null,
  primary key (user_id, id)
);

create table if not exists public.day_steps (
  user_id uuid not null references auth.users (id) on delete cascade,
  date bigint not null,
  steps integer not null check (steps >= 0 and steps <= 200000),
  updated_ms bigint not null,
  primary key (user_id, date)
);

create table if not exists public.settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_ms bigint not null
);

-- Shared: feed posts (route shape only, never coordinates) and cheers
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  act_id text not null,
  type text not null check (type in ('walk', 'run')),
  distance integer not null check (distance >= 0),
  duration integer not null check (duration >= 0),
  steps integer not null default 0,
  elev_gain integer,
  note text check (char_length(note) <= 140),
  shape jsonb not null default '[]'::jsonb,
  start bigint not null,
  created_at timestamptz not null default now(),
  unique (user_id, act_id)
);
create index if not exists posts_created_idx on public.posts (created_at desc);

create table if not exists public.cheers (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- Create a profile row automatically when someone signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row level security
alter table public.profiles   enable row level security;
alter table public.activities enable row level security;
alter table public.day_steps  enable row level security;
alter table public.settings   enable row level security;
alter table public.posts      enable row level security;
alter table public.cheers     enable row level security;

drop policy if exists "profiles readable by signed-in users" on public.profiles;
create policy "profiles readable by signed-in users" on public.profiles for select to authenticated using (true);
drop policy if exists "users edit own profile" on public.profiles;
create policy "users edit own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "users insert own profile" on public.profiles;
create policy "users insert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);

drop policy if exists "own activities" on public.activities;
create policy "own activities" on public.activities for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own day steps" on public.day_steps;
create policy "own day steps" on public.day_steps for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own settings" on public.settings;
create policy "own settings" on public.settings for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "feed readable by signed-in users" on public.posts;
create policy "feed readable by signed-in users" on public.posts for select to authenticated using (true);
drop policy if exists "users write own posts" on public.posts;
create policy "users write own posts" on public.posts for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "users update own posts" on public.posts;
create policy "users update own posts" on public.posts for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "users delete own posts" on public.posts;
create policy "users delete own posts" on public.posts for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "cheers readable by signed-in users" on public.cheers;
create policy "cheers readable by signed-in users" on public.cheers for select to authenticated using (true);
drop policy if exists "users add own cheers" on public.cheers;
create policy "users add own cheers" on public.cheers for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "users remove own cheers" on public.cheers;
create policy "users remove own cheers" on public.cheers for delete to authenticated using (auth.uid() = user_id);
