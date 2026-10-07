-- ============================================================
-- U& Test Data Cleanup Script
-- Run this in Supabase SQL Editor to wipe test data before production
-- ============================================================

-- ── OPTION A: CLEAR TEST ACTIVITIES ONLY ────────────────────
-- Keeps your couple account & pair intact, but wipes all test posts.
-- (Uncomment lines below if you want to keep your couple pair intact)

TRUNCATE TABLE public.trail_entries CASCADE;
TRUNCATE TABLE public.spark_prompts CASCADE;
TRUNCATE TABLE public.someday_capsules CASCADE;
TRUNCATE TABLE public.pick_swipes CASCADE;
TRUNCATE TABLE public.nudges CASCADE;

-- Clear static custom cards if any were added
-- TRUNCATE TABLE public.pick_cards CASCADE;

-- ── OPTION B: FULL FRESH RESET (OPTIONAL) ───────────────────
-- Wipes EVERYTHING (activity data, friend spaces, pair links, profiles)
-- so you and real users can start from scratch.
-- (Uncomment lines below if you want a complete 100% blank slate)

-- TRUNCATE TABLE public.friend_space_members CASCADE;
-- TRUNCATE TABLE public.friend_spaces CASCADE;
-- TRUNCATE TABLE public.space_members CASCADE;
-- TRUNCATE TABLE public.pairs CASCADE;
-- UPDATE public.profiles SET pair_id = NULL;
