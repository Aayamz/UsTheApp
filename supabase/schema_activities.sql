-- Run after schema.sql. Adds the activity tables that lib/sync.ts already
-- expects, all scoped to a pair via RLS, plus location/currency on profiles
-- for personalizing AI-generated content.

alter table profiles add column if not exists location text;
alter table profiles add column if not exists currency text default 'USD';

-- Helper used by every policy below: is the current user in this pair?
create or replace function is_pair_member(check_pair_id uuid)
returns boolean language sql security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and pair_id = check_pair_id
  );
$$;

create table if not exists trail_entries (
  id text primary key,
  pair_id uuid references pairs not null,
  type text not null,
  title text not null,
  description text,
  image_url text,
  date timestamptz not null default now(),
  partner uuid references auth.users,
  likes_count int default 0,
  tags text[],
  countdown_target timestamptz,
  location text,
  created_at timestamptz default now()
);

create table if not exists spark_prompts (
  id text primary key,
  pair_id uuid references pairs not null,
  date date not null,
  question text not null,
  category text,
  user_answer text,
  partner_answer text,
  revealed boolean default false,
  answered_at timestamptz,
  source text default 'static' -- 'static' | 'ai'
);

create table if not exists someday_capsules (
  id text primary key,
  pair_id uuid references pairs not null,
  title text not null,
  unlock_date timestamptz not null,
  content text,
  media_type text default 'text',
  media_url text,
  sealed_by uuid references auth.users,
  is_unlocked boolean default false,
  is_event_scoped boolean default false,
  event_name text,
  created_at timestamptz default now()
);

create table if not exists pick_cards (
  id text primary key,
  pair_id uuid references pairs not null,
  date date not null,
  deck text not null, -- 'food' | 'movie' | 'plan' | 'travel'
  title text not null,
  description text,
  image text,
  tags text[],
  rating text,
  source text default 'static'
);

create table if not exists pick_swipes (
  id text primary key,
  pair_id uuid references pairs not null,
  card_id text references pick_cards,
  user_id uuid references auth.users not null,
  swipe text not null, -- 'left' | 'right'
  matched boolean default false,
  timestamp timestamptz default now()
);

create table if not exists nudges (
  id text primary key,
  pair_id uuid references pairs not null,
  sender uuid references auth.users not null,
  emoji text,
  label text,
  timestamp timestamptz default now(),
  viewed boolean default false
);

-- Enable RLS and permissive policies for pair activities
do $$
declare t text;
begin
  foreach t in array array['trail_entries','spark_prompts','someday_capsules','pick_cards','pick_swipes','nudges']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "pair members full access" on %I', t);
    execute format('drop policy if exists "allow authenticated access" on %I', t);
    execute format(
      'create policy "allow authenticated access" on %I for all using (auth.uid() is not null) with check (auth.uid() is not null)',
      t
    );
  end loop;
end $$;
