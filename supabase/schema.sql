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
drop policy if exists "read own or open pairs" on pairs;
create policy "read own or open pairs"
  on pairs for select
  using (
    created_by = auth.uid()
    or partner_id = auth.uid()
    or partner_id is null
  );

drop policy if exists "create own pair" on pairs;
create policy "create own pair"
  on pairs for insert
  with check (created_by = auth.uid());

drop policy if exists "join open invite" on pairs;
create policy "join open invite"
  on pairs for update
  using (partner_id is null or partner_id = auth.uid())
  with check (partner_id = auth.uid());

-- PROFILES policies
drop policy if exists "read own profile" on profiles;
create policy "read own profile"
  on profiles for select
  using (id = auth.uid());

create or replace function public.get_my_pair_id()
returns uuid language sql security definer set search_path = '' as $$
  select pair_id from public.profiles where id = auth.uid() limit 1;
$$;

drop policy if exists "read partner profile" on profiles;
create policy "read partner profile"
  on profiles for select
  using (
    pair_id is not null
    and pair_id = public.get_my_pair_id()
  );

drop policy if exists "upsert own profile" on profiles;
create policy "upsert own profile"
  on profiles for insert
  with check (id = auth.uid());

drop policy if exists "update own profile" on profiles;
create policy "update own profile"
  on profiles for update
  using (id = auth.uid());

-- Automatic trigger to create profile row when new auth user registers
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
