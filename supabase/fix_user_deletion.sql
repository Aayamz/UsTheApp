-- Fix User Deletion & Foreign Key Cascades in Supabase
-- Run this entire script in Supabase SQL Editor (Dashboard -> SQL Editor -> New query)

-- 1. Safely drop ALL foreign key constraints in public schema using pg_constraint catalog
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

-- 2. Ensure columns allow NULL where appropriate for ON DELETE SET NULL
ALTER TABLE public.pairs ALTER COLUMN partner_id DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN pair_id DROP NOT NULL;

DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'someday_capsules') THEN
        ALTER TABLE public.someday_capsules ALTER COLUMN sealed_by DROP NOT NULL;
        ALTER TABLE public.someday_capsules ALTER COLUMN pair_id DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'trail_entries') THEN
        ALTER TABLE public.trail_entries ALTER COLUMN pair_id DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'spark_prompts') THEN
        ALTER TABLE public.spark_prompts ALTER COLUMN pair_id DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pick_cards') THEN
        ALTER TABLE public.pick_cards ALTER COLUMN pair_id DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pick_swipes') THEN
        ALTER TABLE public.pick_swipes ALTER COLUMN pair_id DROP NOT NULL;
        ALTER TABLE public.pick_swipes ALTER COLUMN user_id DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'nudges') THEN
        ALTER TABLE public.nudges ALTER COLUMN pair_id DROP NOT NULL;
        ALTER TABLE public.nudges ALTER COLUMN sender DROP NOT NULL;
    END IF;
END $$;

-- 3. Clean up any pre-existing orphan rows to prevent constraint addition failures
DELETE FROM public.profiles WHERE id NOT IN (SELECT id FROM auth.users);
UPDATE public.profiles SET pair_id = NULL WHERE pair_id IS NOT NULL AND pair_id NOT IN (SELECT id FROM public.pairs);
DELETE FROM public.pairs WHERE created_by NOT IN (SELECT id FROM auth.users);
UPDATE public.pairs SET partner_id = NULL WHERE partner_id IS NOT NULL AND partner_id NOT IN (SELECT id FROM auth.users);

-- 4. Re-add foreign key constraints with explicit CASCADE / SET NULL rules
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_pair_id_fkey;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pair_id_fkey FOREIGN KEY (pair_id) REFERENCES public.pairs(id) ON DELETE SET NULL;

ALTER TABLE public.pairs DROP CONSTRAINT IF EXISTS pairs_created_by_fkey;
ALTER TABLE public.pairs ADD CONSTRAINT pairs_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.pairs DROP CONSTRAINT IF EXISTS pairs_partner_id_fkey;
ALTER TABLE public.pairs ADD CONSTRAINT pairs_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES auth.users(id) ON DELETE SET NULL;

DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'space_members') THEN
        ALTER TABLE public.space_members DROP CONSTRAINT IF EXISTS space_members_space_id_fkey;
        ALTER TABLE public.space_members ADD CONSTRAINT space_members_space_id_fkey FOREIGN KEY (space_id) REFERENCES public.pairs(id) ON DELETE CASCADE;
        
        ALTER TABLE public.space_members DROP CONSTRAINT IF EXISTS space_members_user_id_fkey;
        ALTER TABLE public.space_members ADD CONSTRAINT space_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'trail_entries') THEN
        ALTER TABLE public.trail_entries DROP CONSTRAINT IF EXISTS trail_entries_pair_id_fkey;
        ALTER TABLE public.trail_entries ADD CONSTRAINT trail_entries_pair_id_fkey FOREIGN KEY (pair_id) REFERENCES public.pairs(id) ON DELETE CASCADE;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'spark_prompts') THEN
        ALTER TABLE public.spark_prompts DROP CONSTRAINT IF EXISTS spark_prompts_pair_id_fkey;
        ALTER TABLE public.spark_prompts ADD CONSTRAINT spark_prompts_pair_id_fkey FOREIGN KEY (pair_id) REFERENCES public.pairs(id) ON DELETE CASCADE;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'someday_capsules') THEN
        ALTER TABLE public.someday_capsules DROP CONSTRAINT IF EXISTS someday_capsules_pair_id_fkey;
        ALTER TABLE public.someday_capsules ADD CONSTRAINT someday_capsules_pair_id_fkey FOREIGN KEY (pair_id) REFERENCES public.pairs(id) ON DELETE CASCADE;
        
        ALTER TABLE public.someday_capsules DROP CONSTRAINT IF EXISTS someday_capsules_sealed_by_fkey;
        ALTER TABLE public.someday_capsules ADD CONSTRAINT someday_capsules_sealed_by_fkey FOREIGN KEY (sealed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pick_cards') THEN
        ALTER TABLE public.pick_cards DROP CONSTRAINT IF EXISTS pick_cards_pair_id_fkey;
        ALTER TABLE public.pick_cards ADD CONSTRAINT pick_cards_pair_id_fkey FOREIGN KEY (pair_id) REFERENCES public.pairs(id) ON DELETE CASCADE;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pick_swipes') THEN
        ALTER TABLE public.pick_swipes DROP CONSTRAINT IF EXISTS pick_swipes_pair_id_fkey;
        ALTER TABLE public.pick_swipes ADD CONSTRAINT pick_swipes_pair_id_fkey FOREIGN KEY (pair_id) REFERENCES public.pairs(id) ON DELETE CASCADE;
        
        ALTER TABLE public.pick_swipes DROP CONSTRAINT IF EXISTS pick_swipes_user_id_fkey;
        ALTER TABLE public.pick_swipes ADD CONSTRAINT pick_swipes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'nudges') THEN
        ALTER TABLE public.nudges DROP CONSTRAINT IF EXISTS nudges_pair_id_fkey;
        ALTER TABLE public.nudges ADD CONSTRAINT nudges_pair_id_fkey FOREIGN KEY (pair_id) REFERENCES public.pairs(id) ON DELETE CASCADE;
        
        ALTER TABLE public.nudges DROP CONSTRAINT IF EXISTS nudges_sender_fkey;
        ALTER TABLE public.nudges ADD CONSTRAINT nudges_sender_fkey FOREIGN KEY (sender) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 5. Helper function to delete a user directly by email
CREATE OR REPLACE FUNCTION public.delete_user_by_email(target_email text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    target_id uuid;
BEGIN
    SELECT id INTO target_id FROM auth.users WHERE email = target_email;
    IF target_id IS NULL THEN
        RETURN 'User not found';
    END IF;
    
    DELETE FROM auth.users WHERE id = target_id;
    RETURN 'User successfully deleted';
END;
$$;
