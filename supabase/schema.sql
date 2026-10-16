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

-- =====================================================================
-- Friends (safe to run again)
-- Only you and your accepted friends can see your posts, cheers and name.
-- Requests are made with a short friend code; all changes go through the
-- functions below so the rules can't be bypassed from the app.
-- =====================================================================

alter table public.profiles add column if not exists friend_code text unique;

-- 6 characters, no look-alikes (no 0/O, 1/I/L)
create or replace function public.new_friend_code()
returns text language plpgsql as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  c text;
begin
  loop
    c := '';
    for i in 1..6 loop
      c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where friend_code = c);
  end loop;
  return c;
end;
$$;

create or replace function public.set_friend_code()
returns trigger language plpgsql as $$
begin
  if new.friend_code is null then new.friend_code := public.new_friend_code(); end if;
  return new;
end;
$$;
drop trigger if exists profiles_friend_code on public.profiles;
create trigger profiles_friend_code before insert on public.profiles
  for each row execute function public.set_friend_code();
update public.profiles set friend_code = public.new_friend_code() where friend_code is null;

create table if not exists public.friendships (
  requester uuid not null references public.profiles (id) on delete cascade,
  addressee uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);
-- one friendship per pair, whoever asked first
create unique index if not exists friendships_pair
  on public.friendships (least(requester, addressee), greatest(requester, addressee));

create table if not exists public.blocks (
  blocker uuid not null references public.profiles (id) on delete cascade,
  blocked uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked)
);

create or replace function public.are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from friendships
    where status = 'accepted'
      and ((requester = a and addressee = b) or (requester = b and addressee = a))
  );
$$;

-- friends, or a request either way (so you can see who asked you)
create or replace function public.is_connected(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from friendships
    where (requester = a and addressee = b) or (requester = b and addressee = a)
  );
$$;

create or replace function public.send_friend_request(code text)
returns text language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  them uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  select id into them from profiles where friend_code = upper(regexp_replace(coalesce(code, ''), '[^A-Za-z0-9]', '', 'g'));
  if them is null then return 'not_found'; end if;
  if them = me then return 'self'; end if;
  -- a block either way looks like an unknown code, so nobody learns they were blocked
  if exists (select 1 from blocks where (blocker = them and blocked = me) or (blocker = me and blocked = them)) then
    return 'not_found';
  end if;
  if are_friends(me, them) then return 'already_friends'; end if;
  -- they already asked you: adding them back makes you friends
  if exists (select 1 from friendships where requester = them and addressee = me and status = 'pending') then
    update friendships set status = 'accepted' where requester = them and addressee = me;
    return 'accepted';
  end if;
  if exists (select 1 from friendships where requester = me and addressee = them) then return 'already_sent'; end if;
  insert into friendships (requester, addressee) values (me, them);
  return 'sent';
end;
$$;

create or replace function public.respond_friend_request(other uuid, accept boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if accept then
    update friendships set status = 'accepted'
      where requester = other and addressee = auth.uid() and status = 'pending';
  else
    delete from friendships where requester = other and addressee = auth.uid() and status = 'pending';
  end if;
end;
$$;

-- also cancels a request you sent
create or replace function public.remove_friend(other uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from friendships
    where (requester = auth.uid() and addressee = other) or (requester = other and addressee = auth.uid());
end;
$$;

create or replace function public.block_user(other uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or other = auth.uid() then return; end if;
  delete from friendships
    where (requester = auth.uid() and addressee = other) or (requester = other and addressee = auth.uid());
  insert into blocks (blocker, blocked) values (auth.uid(), other) on conflict do nothing;
end;
$$;

revoke all on function public.new_friend_code() from public, anon, authenticated;
revoke all on function public.send_friend_request(text), public.respond_friend_request(uuid, boolean),
  public.remove_friend(uuid), public.block_user(uuid), public.are_friends(uuid, uuid), public.is_connected(uuid, uuid) from public, anon;
grant execute on function public.send_friend_request(text), public.respond_friend_request(uuid, boolean),
  public.remove_friend(uuid), public.block_user(uuid), public.are_friends(uuid, uuid), public.is_connected(uuid, uuid) to authenticated;

alter table public.friendships enable row level security;
alter table public.blocks enable row level security;

drop policy if exists "see your own friendships" on public.friendships;
create policy "see your own friendships" on public.friendships for select to authenticated
  using (auth.uid() in (requester, addressee));
drop policy if exists "see who you blocked" on public.blocks;
create policy "see who you blocked" on public.blocks for select to authenticated using (blocker = auth.uid());
drop policy if exists "unblock" on public.blocks;
create policy "unblock" on public.blocks for delete to authenticated using (blocker = auth.uid());

-- Replace the old "everyone signed in can see everything" rules with friends-only rules
drop policy if exists "profiles readable by signed-in users" on public.profiles;
drop policy if exists "profiles visible to you and your connections" on public.profiles;
create policy "profiles visible to you and your connections" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_connected(auth.uid(), id));

drop policy if exists "feed readable by signed-in users" on public.posts;
drop policy if exists "posts visible to you and your friends" on public.posts;
create policy "posts visible to you and your friends" on public.posts for select to authenticated
  using (user_id = auth.uid() or public.are_friends(auth.uid(), user_id));

drop policy if exists "cheers readable by signed-in users" on public.cheers;
drop policy if exists "cheers on posts you can see" on public.cheers;
create policy "cheers on posts you can see" on public.cheers for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
drop policy if exists "users add own cheers" on public.cheers;
create policy "users add own cheers" on public.cheers for insert to authenticated
  with check (auth.uid() = user_id and exists (select 1 from public.posts p where p.id = post_id));

-- =====================================================================
-- Badge level (1 to 8), shown to your friends. Set by the app from your
-- active days; only you can change your own (existing profile rules).
-- =====================================================================
alter table public.profiles add column if not exists badge_level smallint not null default 1;
do $$ begin
  alter table public.profiles add constraint profiles_badge_level_range check (badge_level between 1 and 8);
exception when duplicate_object then null; end $$;
