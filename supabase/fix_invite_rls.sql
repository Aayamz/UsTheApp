-- Fix RLS Policies in Supabase for Pairs, Profiles, and Space Members
-- Run this in Supabase SQL Editor so any signed-in user can look up pairs, profiles, and space members

DROP POLICY IF EXISTS "read own or open pairs" ON public.pairs;
DROP POLICY IF EXISTS "read pairs" ON public.pairs;
CREATE POLICY "read pairs" ON public.pairs FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "read own profile" ON public.profiles;
DROP POLICY IF EXISTS "read partner profile" ON public.profiles;
DROP POLICY IF EXISTS "read profiles" ON public.profiles;
CREATE POLICY "read profiles" ON public.profiles FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "allow authenticated access" ON public.space_members;
DROP POLICY IF EXISTS "read space_members" ON public.space_members;
CREATE POLICY "read space_members" ON public.space_members FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "allow authenticated access" ON public.space_members FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

