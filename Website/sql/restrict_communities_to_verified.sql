-- Migration: restrict community creation to verified creators
-- Run this in Supabase SQL editor to enforce at DB level

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='communities' AND policyname='Users can create communities') THEN
    DROP POLICY "Users can create communities" ON public.communities;
  END IF;
END $$;

CREATE POLICY "Users can create communities" ON public.communities
  FOR INSERT
  WITH CHECK (
    -- owner must be the authenticated user and be verified in profiles
    auth.uid() = owner_id
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_verified = true
    )
  );

-- Helpful note: This will prevent non-verified users from inserting via RLS.
