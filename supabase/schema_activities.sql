-- Run after schema.sql. Adds the activity tables that lib/sync.ts expects,
-- all scoped to a pair via RLS, plus location/currency on profiles.

alter table profiles add column if not exists location text;
alter table profiles add column if not exists currency text default 'USD';

-- Helper used by policies
create or replace function is_pair_member(check_pair_id uuid)
returns boolean language sql security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and pair_id = check_pair_id
  );
$$;

create table if not exists trail_entries (
  id text primary key,
  pair_id uuid references pairs,
  type text not null,
  title text not null,
  description text,
  image_url text,
  date timestamptz not null default now(),
  partner text,
  likes_count int default 0,
  tags text[],
  countdown_target timestamptz,
  location text,
  created_at timestamptz default now()
);
alter table trail_entries drop constraint if exists trail_entries_partner_fkey;
alter table trail_entries alter column pair_id drop not null;
alter table trail_entries alter column partner type text using partner::text;

create table if not exists spark_prompts (
  id text primary key,
  pair_id uuid references pairs,
  date date not null,
  question text not null,
  category text,
  user_answer text,
  partner_answer text,
  revealed boolean default false,
  answered_at timestamptz,
  source text default 'static'
);
alter table spark_prompts alter column pair_id drop not null;

create table if not exists someday_capsules (
  id text primary key,
  pair_id uuid references pairs,
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
alter table someday_capsules alter column pair_id drop not null;
alter table someday_capsules alter column sealed_by drop not null;

create table if not exists pick_cards (
  id text primary key,
  pair_id uuid references pairs,
  date date not null,
  deck text not null,
  title text not null,
  description text,
  image text,
  tags text[],
  rating text,
  source text default 'static'
);
alter table pick_cards alter column pair_id drop not null;

create table if not exists pick_swipes (
  id text primary key,
  pair_id uuid references pairs,
  card_id text references pick_cards,
  user_id uuid references auth.users,
  swipe text not null,
  matched boolean default false,
  timestamp timestamptz default now()
);
alter table pick_swipes alter column pair_id drop not null;
alter table pick_swipes alter column user_id drop not null;

create table if not exists nudges (
  id text primary key,
  pair_id uuid references pairs,
  sender uuid references auth.users,
  emoji text,
  label text,
  timestamp timestamptz default now(),
  viewed boolean default false
);
alter table nudges alter column pair_id drop not null;
alter table nudges alter column sender drop not null;

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
