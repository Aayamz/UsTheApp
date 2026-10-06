-- Fix pairs UPDATE policy for joining partners in Supabase
-- Run this in Supabase SQL Editor

DROP POLICY IF EXISTS "join open invite" ON public.pairs;
DROP POLICY IF EXISTS "update pairs" ON public.pairs;

CREATE POLICY "update pairs" ON public.pairs
  FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
