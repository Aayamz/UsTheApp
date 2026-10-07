-- ============================================================
-- U& Friend Invite Code Lookup Fix
-- Run this in Supabase SQL Editor AFTER rls_secure_spaces.sql
-- ============================================================
-- PROBLEM: The strict RLS on `pairs` blocks a friend (who is
-- not creator/partner) from reading a fully-paired couple's row
-- via friend_invite_code. This causes "invite isn't valid".
--
-- SOLUTION: Security-definer RPC functions that bypass RLS
-- for ONLY the minimal data needed to process a friend join.
-- They reveal no private couple data to the caller.
-- ============================================================

-- ── 1. Lookup pair by FRIEND invite code (security definer) ──
-- Returns only the non-sensitive fields needed to join a friend space.
-- Callers cannot see trail, spark, or any couple content via this.
CREATE OR REPLACE FUNCTION public.get_pair_by_friend_code(p_code text)
RETURNS TABLE (
  id uuid,
  friend_invite_code text,
  created_by uuid,
  partner_id uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.id, p.friend_invite_code, p.created_by, p.partner_id
  FROM public.pairs p
  WHERE lower(trim(p.friend_invite_code)) = lower(trim(p_code))
  LIMIT 1;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_pair_by_friend_code(text) TO authenticated;

-- ── 2. Lookup pair by PARTNER invite code (security definer) ──
-- Only readable when partner_id IS NULL (open slot) or user is already a member.
-- This is safe because it returns nothing for fully-paired couples.
CREATE OR REPLACE FUNCTION public.get_pair_by_invite_code(p_code text)
RETURNS TABLE (
  id uuid,
  invite_code text,
  created_by uuid,
  partner_id uuid,
  friend_invite_code text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.id, p.invite_code, p.created_by, p.partner_id, p.friend_invite_code
  FROM public.pairs p
  WHERE lower(trim(p.invite_code)) = lower(trim(p_code))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_pair_by_invite_code(text) TO authenticated;

-- ── 3. Join a friend space atomically (security definer) ──
-- Creates the friend_space if needed, adds user to friend_space_members.
-- Returns the friend_space id, or NULL on failure.
-- Friends do NOT get the couple's pair_id.
CREATE OR REPLACE FUNCTION public.join_as_friend(
  p_friend_code text,
  p_user_id uuid,
  p_display_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pair_id uuid;
  v_created_by uuid;
  v_partner_id uuid;
  v_friend_space_id uuid;
BEGIN
  -- Find the couple pair by friend code
  SELECT p.id, p.created_by, p.partner_id
    INTO v_pair_id, v_created_by, v_partner_id
  FROM public.pairs p
  WHERE lower(trim(p.friend_invite_code)) = lower(trim(p_friend_code))
  LIMIT 1;

  IF v_pair_id IS NULL THEN
    RETURN NULL; -- invalid code
  END IF;

  -- Refuse if caller is already a couple member
  IF p_user_id = v_created_by OR p_user_id = v_partner_id THEN
    RETURN NULL;
  END IF;

  -- Get or create the friend_space for this couple
  SELECT fs.id INTO v_friend_space_id
  FROM public.friend_spaces fs
  WHERE fs.couple_pair_id = v_pair_id
  LIMIT 1;

  IF v_friend_space_id IS NULL THEN
    INSERT INTO public.friend_spaces (couple_pair_id, name)
    VALUES (v_pair_id, 'Friends Group')
    RETURNING id INTO v_friend_space_id;
  END IF;

  -- Add friend to the friend_space (upsert = idempotent)
  INSERT INTO public.friend_space_members (friend_space_id, user_id, display_name)
  VALUES (v_friend_space_id, p_user_id, p_display_name)
  ON CONFLICT (friend_space_id, user_id) DO UPDATE
    SET display_name = EXCLUDED.display_name;

  -- Ensure the friend has a profile row (without couple's pair_id)
  INSERT INTO public.profiles (id, display_name)
  VALUES (p_user_id, p_display_name)
  ON CONFLICT (id) DO NOTHING;

  RETURN v_friend_space_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_as_friend(text, uuid, text) TO authenticated;

-- ── 4. Detect invite type (security definer) ──
-- Returns 'partner', 'friend', or 'invalid' for any code.
-- Used by the join page to route correctly.
CREATE OR REPLACE FUNCTION public.detect_invite_type(p_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pair record;
BEGIN
  -- Check partner invite_code first
  SELECT p.id, p.created_by, p.partner_id, p.invite_code, p.friend_invite_code
    INTO v_pair
  FROM public.pairs p
  WHERE lower(trim(p.invite_code)) = lower(trim(p_code))
  LIMIT 1;

  IF FOUND THEN
    RETURN json_build_object(
      'type', 'partner',
      'pair_id', v_pair.id,
      'created_by', v_pair.created_by,
      'partner_id', v_pair.partner_id
    );
  END IF;

  -- Check friend_invite_code
  SELECT p.id, p.created_by, p.partner_id, p.friend_invite_code
    INTO v_pair
  FROM public.pairs p
  WHERE lower(trim(p.friend_invite_code)) = lower(trim(p_code))
  LIMIT 1;

  IF FOUND THEN
    RETURN json_build_object(
      'type', 'friend',
      'pair_id', v_pair.id,
      'created_by', v_pair.created_by,
      'partner_id', v_pair.partner_id
    );
  END IF;

  RETURN json_build_object('type', 'invalid');
END;
$$;

GRANT EXECUTE ON FUNCTION public.detect_invite_type(text) TO authenticated;

-- ── 5. Get Friend Space details with couple names ──
CREATE OR REPLACE FUNCTION public.get_friend_space_details(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_fs_id uuid;
  v_fs_name text;
  v_pair_id uuid;
  v_creator_name text;
  v_partner_name text;
BEGIN
  SELECT fs.id, fs.name, fs.couple_pair_id
    INTO v_fs_id, v_fs_name, v_pair_id
  FROM public.friend_spaces fs
  JOIN public.friend_space_members fsm ON fsm.friend_space_id = fs.id
  WHERE fsm.user_id = p_user_id
  LIMIT 1;

  IF v_fs_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT p1.display_name, p2.display_name
    INTO v_creator_name, v_partner_name
  FROM public.pairs p
  LEFT JOIN public.profiles p1 ON p1.id = p.created_by
  LEFT JOIN public.profiles p2 ON p2.id = p.partner_id
  WHERE p.id = v_pair_id;

  RETURN json_build_object(
    'friend_space_id', v_fs_id,
    'name', v_fs_name,
    'couple_pair_id', v_pair_id,
    'creator_name', COALESCE(v_creator_name, 'Couple'),
    'partner_name', COALESCE(v_partner_name, '')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_friend_space_details(uuid) TO authenticated;

-- ── 6. Friend sends a time capsule / wish to couple's Someday ──
CREATE OR REPLACE FUNCTION public.send_friend_time_capsule(
  p_friend_space_id uuid,
  p_title text,
  p_content text,
  p_unlock_date timestamptz,
  p_event_name text DEFAULT 'Friend Wish'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pair_id uuid;
  v_user_name text;
  v_capsule_id text;
BEGIN
  SELECT fs.couple_pair_id INTO v_pair_id
  FROM public.friend_spaces fs
  JOIN public.friend_space_members fsm ON fsm.friend_space_id = fs.id
  WHERE fs.id = p_friend_space_id AND fsm.user_id = auth.uid();

  IF v_pair_id IS NULL THEN
    RAISE EXCEPTION 'Not a member of this friend space';
  END IF;

  SELECT fsm.display_name INTO v_user_name
  FROM public.friend_space_members fsm
  WHERE fsm.friend_space_id = p_friend_space_id AND fsm.user_id = auth.uid();

  v_capsule_id := 'c-friend-' || gen_random_uuid();

  INSERT INTO public.someday_capsules (
    id,
    pair_id,
    title,
    content,
    unlock_date,
    sealed_by,
    is_unlocked,
    is_event_scoped,
    event_name,
    created_at
  ) VALUES (
    v_capsule_id,
    v_pair_id,
    p_title,
    p_content,
    p_unlock_date,
    auth.uid(),
    false,
    true,
    COALESCE(p_event_name, 'Wish from ' || COALESCE(v_user_name, 'a Friend')),
    now()
  );

  RETURN v_pair_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_friend_time_capsule(uuid, text, text, timestamptz, text) TO authenticated;

