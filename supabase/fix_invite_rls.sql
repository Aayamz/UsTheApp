-- Fix Invite RLS Policy in Supabase
-- Run this in Supabase SQL Editor so any signed-in user can look up pairs by invite code

DROP POLICY IF EXISTS "read own or open pairs" ON public.pairs;
DROP POLICY IF EXISTS "read pairs" ON public.pairs;

CREATE POLICY "read pairs" ON public.pairs FOR SELECT USING (auth.uid() IS NOT NULL);
