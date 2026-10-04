-- Run this in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).

create table if not exists pairs (
  id uuid primary key default gen_random_uuid(),
  invite_code text unique not null default substr(md5(random()::text), 1, 8),
  created_by uuid references auth.users not null,
  partner_id uuid references auth.users,
  created_at timestamptz default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  pair_id uuid references pairs,
  display_name text,
  avatar_url text,
  created_at timestamptz default now()
);

alter table pairs enable row level security;
alter table profiles enable row level security;

-- PAIRS policies
-- Anyone signed in can read a pair row that's either theirs already,
-- or still open (no partner yet) -- needed so the /join/[code] page can
-- preview an invite before the second person has joined it.
create policy "read own or open pairs"
  on pairs for select
  using (
    created_by = auth.uid()
    or partner_id = auth.uid()
    or partner_id is null
  );

create policy "create own pair"
  on pairs for insert
  with check (created_by = auth.uid());

-- Claiming an open invite: only allowed while partner_id is still null,
-- and you can only ever set it to yourself.
create policy "join open invite"
  on pairs for update
  using (partner_id is null)
  with check (partner_id = auth.uid());

-- PROFILES policies
create policy "read own profile"
  on profiles for select
  using (id = auth.uid());

create policy "read partner profile"
  on profiles for select
  using (
    pair_id is not null
    and pair_id = (select pair_id from profiles p2 where p2.id = auth.uid())
  );

create policy "upsert own profile"
  on profiles for insert
  with check (id = auth.uid());

create policy "update own profile"
  on profiles for update
  using (id = auth.uid());
