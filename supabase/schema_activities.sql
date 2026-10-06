-- Run after schema.sql. Adds the activity tables that lib/sync.ts expects,
-- all scoped to a pair via RLS, plus location/currency on profiles.

alter table profiles add column if not exists location text;
alter table profiles add column if not exists currency text default 'USD';

-- Cascading user delete rules for profiles & pairs (dynamic cleanup)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conrelid::regclass::text AS tbl, conname AS cname
        FROM pg_constraint
        WHERE contype = 'f'
          AND connamespace = 'public'::regnamespace
    ) LOOP
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I', r.tbl, r.cname);
    END LOOP;
END $$;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE pairs DROP CONSTRAINT IF EXISTS pairs_created_by_fkey;
ALTER TABLE pairs ADD CONSTRAINT pairs_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE pairs DROP CONSTRAINT IF EXISTS pairs_partner_id_fkey;
ALTER TABLE pairs ADD CONSTRAINT pairs_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_pair_id_fkey;
ALTER TABLE profiles ADD CONSTRAINT profiles_pair_id_fkey FOREIGN KEY (pair_id) REFERENCES pairs(id) ON DELETE SET NULL;

-- Helper used by policies
create or replace function is_pair_member(check_pair_id uuid)
returns boolean language sql security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and pair_id = check_pair_id
  );
$$;

create table if not exists space_members (
  id uuid primary key default gen_random_uuid(),
  space_id uuid references pairs on delete cascade,
  user_id uuid references auth.users on delete cascade,
  role text default 'friend', -- 'partner' | 'friend'
  created_at timestamptz default now(),
  unique(space_id, user_id)
);

create table if not exists trail_entries (
  id text primary key,
  pair_id uuid references pairs on delete cascade,
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
alter table trail_entries drop constraint if exists trail_entries_pair_id_fkey;
alter table trail_entries add constraint trail_entries_pair_id_fkey foreign key (pair_id) references pairs(id) on delete cascade;
alter table trail_entries alter column pair_id drop not null;
alter table trail_entries alter column partner type text using partner::text;

create table if not exists spark_prompts (
  id text primary key,
  pair_id uuid references pairs on delete cascade,
  date date not null,
  question text not null,
  category text,
  user_answer text,
  partner_answer text,
  revealed boolean default false,
  answered_at timestamptz,
  source text default 'static'
);
alter table spark_prompts drop constraint if exists spark_prompts_pair_id_fkey;
alter table spark_prompts add constraint spark_prompts_pair_id_fkey foreign key (pair_id) references pairs(id) on delete cascade;
alter table spark_prompts alter column pair_id drop not null;

create table if not exists someday_capsules (
  id text primary key,
  pair_id uuid references pairs on delete cascade,
  title text not null,
  unlock_date timestamptz not null,
  content text,
  media_type text default 'text',
  media_url text,
  sealed_by uuid references auth.users on delete set null,
  is_unlocked boolean default false,
  is_event_scoped boolean default false,
  event_name text,
  created_at timestamptz default now()
);
alter table someday_capsules drop constraint if exists someday_capsules_pair_id_fkey;
alter table someday_capsules add constraint someday_capsules_pair_id_fkey foreign key (pair_id) references pairs(id) on delete cascade;
alter table someday_capsules alter column pair_id drop not null;
alter table someday_capsules alter column sealed_by drop not null;
alter table someday_capsules drop constraint if exists someday_capsules_sealed_by_fkey;
alter table someday_capsules add constraint someday_capsules_sealed_by_fkey foreign key (sealed_by) references auth.users(id) on delete set null;

create table if not exists pick_cards (
  id text primary key,
  pair_id uuid references pairs on delete cascade,
  date date not null default CURRENT_DATE,
  deck text not null,
  title text not null,
  description text,
  image text,
  tags text[],
  rating text,
  source text default 'static'
);
alter table pick_cards drop constraint if exists pick_cards_pair_id_fkey;
alter table pick_cards add constraint pick_cards_pair_id_fkey foreign key (pair_id) references pairs(id) on delete cascade;
alter table pick_cards alter column pair_id drop not null;

create table if not exists pick_swipes (
  id text primary key,
  pair_id uuid references pairs on delete cascade,
  card_id text,
  user_id uuid references auth.users on delete cascade,
  swipe text not null,
  matched boolean default false,
  timestamp timestamptz default now()
);
alter table pick_swipes drop constraint if exists pick_swipes_pair_id_fkey;
alter table pick_swipes add constraint pick_swipes_pair_id_fkey foreign key (pair_id) references pairs(id) on delete cascade;
alter table pick_swipes drop constraint if exists pick_swipes_card_id_fkey;
alter table pick_swipes alter column pair_id drop not null;
alter table pick_swipes alter column user_id drop not null;
alter table pick_swipes drop constraint if exists pick_swipes_user_id_fkey;
alter table pick_swipes add constraint pick_swipes_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

create table if not exists nudges (
  id text primary key,
  pair_id uuid references pairs on delete cascade,
  sender uuid references auth.users on delete cascade,
  emoji text,
  label text,
  timestamp timestamptz default now(),
  viewed boolean default false
);
alter table nudges drop constraint if exists nudges_pair_id_fkey;
alter table nudges add constraint nudges_pair_id_fkey foreign key (pair_id) references pairs(id) on delete cascade;
alter table nudges alter column pair_id drop not null;
alter table nudges alter column sender drop not null;
alter table nudges drop constraint if exists nudges_sender_fkey;
alter table nudges add constraint nudges_sender_fkey foreign key (sender) references auth.users(id) on delete cascade;

-- Enable RLS and permissive policies for pair activities
do $$
declare t text;
begin
  foreach t in array array['space_members','trail_entries','spark_prompts','someday_capsules','pick_cards','pick_swipes','nudges']
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

-- Enable Supabase Realtime replication on all activity tables
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE space_members, trail_entries, spark_prompts, someday_capsules, pick_cards, pick_swipes, nudges;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Table already in publication or alter handled
  NULL;
END $$;
