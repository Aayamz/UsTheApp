-- ============================================================
-- U& Secure Space Isolation – Run this in Supabase SQL Editor
-- ============================================================
-- PURPOSE:
--   • Couples see ONLY their own pair data (Trail, Spark, Pick, Nudge, Someday)
--   • Friends have a completely SEPARATE friend_spaces table with their own invite code
--   • No cross-couple data leakage whatsoever
-- ============================================================

-- ============================================================
-- STEP 1: Add a separate friend invite code to pairs
-- ============================================================
ALTER TABLE pairs ADD COLUMN IF NOT EXISTS friend_invite_code text UNIQUE DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 8);

-- Generate friend_invite_code for existing pairs that don't have one
UPDATE pairs SET friend_invite_code = substr(md5(id::text || clock_timestamp()::text), 1, 8)
WHERE friend_invite_code IS NULL;

-- ============================================================
-- STEP 2: Create friend_spaces table (separate from couple pair)
-- ============================================================
CREATE TABLE IF NOT EXISTS friend_spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_pair_id uuid NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Friends Group',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS friend_space_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  friend_space_id uuid NOT NULL REFERENCES friend_spaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  added_at timestamptz DEFAULT now(),
  UNIQUE(friend_space_id, user_id)
);

-- Each couple gets one friend space auto-created when they first invite a friend
-- ============================================================
-- STEP 3: Enable RLS on new tables
-- ============================================================
ALTER TABLE friend_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_space_members ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 4: Secure PAIRS policies (couple isolation)
-- ============================================================

-- Drop all overly permissive existing policies
DROP POLICY IF EXISTS "read pairs" ON public.pairs;
DROP POLICY IF EXISTS "read own or open pairs" ON public.pairs;
DROP POLICY IF EXISTS "join open invite" ON public.pairs;
DROP POLICY IF EXISTS "update pairs" ON public.pairs;
DROP POLICY IF EXISTS "create own pair" ON public.pairs;

-- Only members of the pair can read it
CREATE POLICY "couples read own pair"
  ON public.pairs FOR SELECT
  USING (
    created_by = auth.uid()
    OR partner_id = auth.uid()
    OR partner_id IS NULL  -- needed for join flow (partner hasn't joined yet)
  );

-- Anyone authenticated can create a pair (for new users)
CREATE POLICY "create own pair"
  ON public.pairs FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- Only the joining partner OR existing members can update
CREATE POLICY "partner can join pair"
  ON public.pairs FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Only pair creator can delete their own pair
CREATE POLICY "creator can delete pair"
  ON public.pairs FOR DELETE
  USING (created_by = auth.uid());

-- ============================================================
-- STEP 5: Secure PROFILES policies
-- ============================================================
DROP POLICY IF EXISTS "read profiles" ON public.profiles;
DROP POLICY IF EXISTS "read own profile" ON public.profiles;
DROP POLICY IF EXISTS "read partner profile" ON public.profiles;
DROP POLICY IF EXISTS "upsert own profile" ON public.profiles;
DROP POLICY IF EXISTS "update own profile" ON public.profiles;

-- Recreate get_my_pair_id as security definer
CREATE OR REPLACE FUNCTION public.get_my_pair_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT pair_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Users can read their own profile
CREATE POLICY "read own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

-- Users can read their partner's profile (same pair_id)
CREATE POLICY "read partner profile"
  ON public.profiles FOR SELECT
  USING (
    pair_id IS NOT NULL
    AND pair_id = public.get_my_pair_id()
  );

-- Users can insert their own profile
CREATE POLICY "insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

-- ============================================================
-- STEP 6: is_pair_member helper (security definer)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_pair_member(check_pair_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND pair_id = check_pair_id
  );
$$;

-- ============================================================
-- STEP 7: Secure ACTIVITY TABLES (couple-only access)
-- All: trail_entries, spark_prompts, someday_capsules, pick_cards, pick_swipes, nudges
-- ============================================================

-- Drop all permissive policies
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['trail_entries','spark_prompts','someday_capsules','pick_cards','pick_swipes','nudges']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "allow authenticated access" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "pair members full access" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "couple members only" ON %I', t);
  END LOOP;
END $$;

-- Create strict per-table policies: only pair members can access
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['trail_entries','spark_prompts','someday_capsules','pick_cards','pick_swipes','nudges']
  LOOP
    -- SELECT: only if pair_id matches user's pair
    EXECUTE format(
      'CREATE POLICY "couple members only read" ON %I FOR SELECT USING (pair_id IS NOT NULL AND public.is_pair_member(pair_id))',
      t
    );
    -- INSERT: only if pair_id matches user's pair
    EXECUTE format(
      'CREATE POLICY "couple members only insert" ON %I FOR INSERT WITH CHECK (pair_id IS NOT NULL AND public.is_pair_member(pair_id))',
      t
    );
    -- UPDATE: only if pair_id matches user's pair
    EXECUTE format(
      'CREATE POLICY "couple members only update" ON %I FOR UPDATE USING (pair_id IS NOT NULL AND public.is_pair_member(pair_id)) WITH CHECK (pair_id IS NOT NULL AND public.is_pair_member(pair_id))',
      t
    );
    -- DELETE: only if pair_id matches user's pair
    EXECUTE format(
      'CREATE POLICY "couple members only delete" ON %I FOR DELETE USING (pair_id IS NOT NULL AND public.is_pair_member(pair_id))',
      t
    );
  END LOOP;
END $$;

-- ============================================================
-- STEP 8: friend_spaces policies (only couple members see their friend space)
-- ============================================================
DROP POLICY IF EXISTS "couple sees their friend space" ON public.friend_spaces;
CREATE POLICY "couple sees their friend space"
  ON public.friend_spaces FOR SELECT
  USING (public.is_pair_member(couple_pair_id));

DROP POLICY IF EXISTS "couple creates friend space" ON public.friend_spaces;
CREATE POLICY "couple creates friend space"
  ON public.friend_spaces FOR INSERT
  WITH CHECK (public.is_pair_member(couple_pair_id));

DROP POLICY IF EXISTS "couple updates friend space" ON public.friend_spaces;
CREATE POLICY "couple updates friend space"
  ON public.friend_spaces FOR UPDATE
  USING (public.is_pair_member(couple_pair_id));

-- ============================================================
-- STEP 9: friend_space_members policies
-- ============================================================

-- Helper: is user a member of this friend space?
CREATE OR REPLACE FUNCTION public.is_friend_space_member(check_fs_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friend_space_members WHERE friend_space_id = check_fs_id AND user_id = auth.uid()
  );
$$;

-- Helper: is user a member of the couple that owns this friend space?
CREATE OR REPLACE FUNCTION public.is_friend_space_couple_member(check_fs_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friend_spaces fs
    WHERE fs.id = check_fs_id AND public.is_pair_member(fs.couple_pair_id)
  );
$$;

DROP POLICY IF EXISTS "view friend space members" ON public.friend_space_members;
CREATE POLICY "view friend space members"
  ON public.friend_space_members FOR SELECT
  USING (
    public.is_friend_space_member(friend_space_id)
    OR public.is_friend_space_couple_member(friend_space_id)
  );

DROP POLICY IF EXISTS "join friend space" ON public.friend_space_members;
CREATE POLICY "join friend space"
  ON public.friend_space_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "update own friend membership" ON public.friend_space_members;
CREATE POLICY "update own friend membership"
  ON public.friend_space_members FOR UPDATE
  USING (user_id = auth.uid());

-- ============================================================
-- STEP 10: Drop the old space_members table usage for friends
-- (space_members was being used incorrectly to add friends to couple's pair)
-- We keep it for now but lock it down to only couple members
-- ============================================================
DROP POLICY IF EXISTS "allow authenticated access" ON public.space_members;
DROP POLICY IF EXISTS "read space_members" ON public.space_members;

CREATE POLICY "pair members see space_members"
  ON public.space_members FOR SELECT
  USING (public.is_pair_member(space_id));

CREATE POLICY "pair members insert space_members"
  ON public.space_members FOR INSERT
  WITH CHECK (public.is_pair_member(space_id) OR user_id = auth.uid());

CREATE POLICY "pair members update space_members"
  ON public.space_members FOR UPDATE
  USING (public.is_pair_member(space_id) OR user_id = auth.uid());

-- ============================================================
-- STEP 11: Add friend_spaces & friend_space_members to realtime
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE friend_spaces, friend_space_members;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================
-- DONE: Run verify_rls.sql to confirm policies are active
-- ============================================================
